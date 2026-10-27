import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { eq, and, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import {
  encryptSecret,
  decryptSecret,
  hashPassword,
  verifyPassword,
} from "@/lib/admin-crypto";
import { settingsKey } from "./integration-settings";
import { AppError, createSession, rateLimit, requestKey } from "./security";
import { bookingSchema } from "@/lib/domain";
type Credential = { userId: string; username: string; passwordHash: string };
const key = "patient-test-login";
async function credential(): Promise<Credential | null> {
  const [row] = await getDb()
    .select()
    .from(s.integrationSecrets)
    .where(eq(s.integrationSecrets.key, key));
  return row ? JSON.parse(decryptSecret(row.ciphertext, settingsKey())) : null;
}
export async function isTestPatient(userId: string) {
  return (await credential())?.userId === userId;
}
export async function createTestPatient(actorId: string) {
  const previous = await credential();
  const password = randomBytes(18).toString("base64url");
  const username = "patient_test";
  const passwordHash = await hashPassword(password);
  const user = await getDb().transaction(async (tx) => {
    let userId = previous?.userId;
    if (userId) {
      const [user] = await tx
        .select()
        .from(s.users)
        .where(eq(s.users.id, userId));
      if (!user || user.role !== "patient")
        throw new AppError(409, "INVALID_TEST_ACCOUNT");
      await tx.delete(s.sessions).where(eq(s.sessions.userId, userId));
    } else {
      const [user] = await tx
        .insert(s.users)
        .values({
          phone: "09000000000",
          name: "بیمار آزمایشی",
          role: "patient",
        })
        .returning();
      userId = user.id;
    }
    // Creating/resetting this dedicated account also starts a fresh sandbox.
    await tx
      .delete(s.websiteSettings)
      .where(eq(s.websiteSettings.key, recordsKey(userId)));
    const ciphertext = encryptSecret(
      JSON.stringify({ userId, username, passwordHash }),
      settingsKey(),
    );
    await tx
      .insert(s.integrationSecrets)
      .values({ key, ciphertext })
      .onConflictDoUpdate({
        target: s.integrationSecrets.key,
        set: { ciphertext, updatedAt: new Date() },
      });
    await tx.insert(s.auditLogs).values({
      actorId,
      action: "test_patient.credentials_rotated",
      entityType: "user",
      entityId: userId,
    });
    return userId;
  });
  return { userId: user, username, password };
}
export async function loginTestPatient(input: unknown) {
  const data = z
    .object({
      username: z.string().min(1).max(64),
      password: z.string().min(1).max(200),
    })
    .parse(input);
  await rateLimit(`test-patient:ip:${await requestKey()}`, 20, 900);
  await rateLimit(
    `test-patient:username:${data.username.toLowerCase()}`,
    10,
    900,
  );
  const stored = await credential();
  if (
    !stored ||
    !(await verifyPassword(data.password, stored.passwordHash)) ||
    data.username.toLowerCase() !== stored.username
  )
    throw new AppError(401, "INVALID_TEST_LOGIN");
  const [user] = await getDb()
    .select()
    .from(s.users)
    .where(
      and(
        eq(s.users.id, stored.userId),
        eq(s.users.role, "patient"),
        eq(s.users.disabled, false),
      ),
    );
  if (!user) throw new AppError(401, "INVALID_TEST_LOGIN");
  await createSession(user.id);
  return { ok: true };
}
export type TestAppointment = {
  id: string;
  trackingCode: string;
  status: string;
  paymentStatus: string;
  priceRial: number;
  durationMinutes: number;
  typeSnapshot: { key: string; testMode: true };
  platformSnapshot: unknown;
  slotId: null;
  startsAt: string | null;
  createdAt: string;
  idempotencyKey: string;
  testReceipt?: boolean;
};
const recordsKey = (id: string) => `test-patient-bookings:${id}`;
export async function testAppointments(userId: string) {
  const [row] = await getDb()
    .select()
    .from(s.websiteSettings)
    .where(eq(s.websiteSettings.key, recordsKey(userId)));
  return (row?.value as TestAppointment[]) || [];
}
export async function bookTestAppointment(userId: string, input: unknown) {
  const data = bookingSchema.parse(input);
  const [type] = await getDb()
    .select()
    .from(s.consultationTypes)
    .where(eq(s.consultationTypes.id, data.consultationTypeId));
  if (!type || !["phone", "text"].includes(type.key))
    throw new AppError(400, "CONSULTATION_UNAVAILABLE");
  if (
    data.expectedPriceRial !== undefined &&
    data.expectedPriceRial !== type.priceRial
  )
    throw new AppError(409, "PRICE_CHANGED");
  const [platform] = data.platformId
    ? await getDb()
        .select()
        .from(s.messagingPlatforms)
        .where(eq(s.messagingPlatforms.id, data.platformId))
    : [];
  if (type.key === "text" && !platform)
    throw new AppError(400, "PLATFORM_REQUIRED");
  let requestedStart: string | null = null;
  if (data.schedulingMode === "patient") {
    const [slot] = await getDb()
      .select()
      .from(s.appointmentSlots)
      .where(
        and(
          eq(s.appointmentSlots.id, data.slotId!),
          eq(s.appointmentSlots.consultationTypeId, type.id),
          eq(s.appointmentSlots.enabled, true),
          gt(s.appointmentSlots.startsAt, new Date()),
        ),
      );
    if (!slot) throw new AppError(409, "SLOT_UNAVAILABLE");
    requestedStart = slot.startsAt.toISOString();
  }
  return updateTestAppointments(userId, (items) => {
    const old = items.find((a) => a.idempotencyKey === data.idempotencyKey);
    if (old) return { items, result: old };
    const item: TestAppointment = {
      id: randomUUID(),
      trackingCode: "TEST-" + randomBytes(6).toString("hex").toUpperCase(),
      status: "awaiting_payment",
      paymentStatus: "awaiting_payment",
      priceRial: type.priceRial,
      durationMinutes: type.durationMinutes,
      typeSnapshot: { key: type.key, testMode: true },
      platformSnapshot: platform || null,
      slotId: null,
      startsAt: requestedStart,
      createdAt: new Date().toISOString(),
      idempotencyKey: data.idempotencyKey,
    };
    return { items: [item, ...items].slice(0, 30), result: item };
  });
}
async function updateTestAppointments<T>(
  userId: string,
  change: (items: TestAppointment[]) => { items: TestAppointment[]; result: T },
) {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${recordsKey(userId)}))`,
    );
    const [row] = await tx
      .select()
      .from(s.websiteSettings)
      .where(eq(s.websiteSettings.key, recordsKey(userId)));
    const next = change((row?.value as TestAppointment[]) || []);
    await tx
      .insert(s.websiteSettings)
      .values({ key: recordsKey(userId), value: next.items })
      .onConflictDoUpdate({
        target: s.websiteSettings.key,
        set: { value: next.items, updatedAt: new Date() },
      });
    return next.result;
  });
}
export async function testPatientAction(
  userId: string,
  id: string,
  input: unknown,
) {
  if (!(await isTestPatient(userId))) throw new AppError(403, "FORBIDDEN");
  const { action } = z
    .object({ action: z.enum(["receipt", "approve", "cancel"]) })
    .parse(input);
  return updateTestAppointments(userId, (items) => {
    const item = items.find((a) => a.id === id);
    if (!item) throw new AppError(404, "NOT_FOUND");
    if (item.status === "cancelled" && action !== "cancel")
      throw new AppError(409, "INVALID_TRANSITION");
    if (action === "receipt") {
      if (item.paymentStatus !== "awaiting_payment")
        throw new AppError(409, "INVALID_TRANSITION");
      item.paymentStatus = "under_review";
      item.status = "awaiting_verification";
      item.testReceipt = true;
    }
    if (action === "approve") {
      if (item.paymentStatus !== "under_review")
        throw new AppError(409, "INVALID_TRANSITION");
      item.paymentStatus = "approved";
      item.status = "confirmed";
      item.startsAt ||= new Date(Date.now() + 86400000).toISOString();
    }
    if (action === "cancel") {
      item.status = "cancelled";
    }
    return { items, result: item };
  });
}
