import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  adminCredentials,
  adminMfaChallenges,
  auditLogs,
  rateLimits,
  sessions,
  users,
  websiteSettings,
  otpChallenges,
} from "@/db/schema";
import { patientTestMode } from "./patient-login-settings";
import {
  decryptSecret,
  hashPassword,
  encryptSecret,
  newTotpSecret,
  totpCounter,
  verifyPassword,
} from "@/lib/admin-crypto";
import {
  AppError,
  createSession,
  currentUser,
  hash,
  isMfaCurrent,
  otpHash,
  rateLimit,
  requestKey,
  requireUser,
} from "./security";
import {
  saveSmsSettings,
  settingsKey,
  storedSmsSettings,
} from "./integration-settings";
import { sendSms } from "./sms";
const passwordSchema = z.string().min(1).max(128);
const codeSchema = z.string().regex(/^\d{6}$/);
const dummy = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;
const roles = ["super_admin", "doctor", "staff"];
async function context() {
  const auth = await currentUser();
  if (!auth || !roles.includes(auth.user.role))
    throw new AppError(401, "SIGN_IN_REQUIRED");
  const [credential] = await getDb()
    .select()
    .from(adminCredentials)
    .where(eq(adminCredentials.userId, auth.user.id));
  if (!credential || !auth.passwordVerified)
    throw new AppError(401, "ADMIN_PASSWORD_REQUIRED");
  const token = (await cookies()).get("medical_session")?.value;
  if (!token) throw new AppError(401, "SIGN_IN_REQUIRED");
  return { auth, credential, sessionHash: hash(token) };
}
async function confirmPassword(value: unknown) {
  const ctx = await context();
  await rateLimit(`admin-password-confirm:${ctx.auth.user.id}`, 20, 900);
  if (
    !(await verifyPassword(
      passwordSchema.parse(value),
      ctx.credential.passwordHash,
    ))
  )
    throw new AppError(403, "INVALID_CREDENTIALS");
  return ctx;
}
async function audit(userId: string, action: string) {
  await getDb().insert(auditLogs).values({
    actorId: userId,
    action,
    entityType: "admin_security",
    entityId: userId,
  });
}
async function issueSms(ctx: Awaited<ReturnType<typeof context>>) {
  await rateLimit(`admin-sms:${ctx.auth.user.id}`, 3, 600);
  const code = String(randomInt(100000, 1000000));
  const value = {
    userId: ctx.auth.user.id,
    sessionHash: ctx.sessionHash,
    codeHash: otpHash(ctx.sessionHash, code),
    attempts: 0,
    expiresAt: new Date(Date.now() + 300000),
    consumedAt: null,
  };
  await getDb()
    .insert(adminMfaChallenges)
    .values(value)
    .onConflictDoUpdate({ target: adminMfaChallenges.sessionHash, set: value });
  try {
    await sendSms(ctx.auth.user.phone, `کد ورود مدیریت: ${code}`, code);
  } catch (error) {
    await getDb()
      .delete(adminMfaChallenges)
      .where(eq(adminMfaChallenges.sessionHash, ctx.sessionHash));
    throw error;
  }
}
async function consumeSms(sessionHash: string, code: string) {
  const result = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(adminMfaChallenges)
      .where(eq(adminMfaChallenges.sessionHash, sessionHash))
      .for("update");
    if (
      !row ||
      row.consumedAt ||
      row.attempts >= 5 ||
      row.expiresAt.getTime() < Date.now()
    )
      return false;
    await tx
      .update(adminMfaChallenges)
      .set({ attempts: row.attempts + 1 })
      .where(eq(adminMfaChallenges.sessionHash, sessionHash));
    if (row.codeHash !== otpHash(sessionHash, code)) return false;
    await tx
      .update(adminMfaChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(adminMfaChallenges.sessionHash, sessionHash));
    return true;
  });
  if (!result) throw new AppError(400, "INVALID_OTP");
}
export async function adminAccess(
  action: string,
  method: string,
  input: unknown,
) {
  const db = getDb();
  if (action === "login" && method === "POST") {
    const data = z
      .object({
        username: z.string().trim().min(3).max(64),
        password: passwordSchema,
      })
      .parse(input);
    const username = data.username.toLowerCase();
    await rateLimit(`admin-login-ip:${await requestKey()}`, 20, 900);
    await rateLimit(`admin-login-user:${hash(username)}`, 10, 900);
    const [row] = await db
      .select({ credential: adminCredentials, user: users })
      .from(adminCredentials)
      .innerJoin(users, eq(users.id, adminCredentials.userId))
      .where(eq(adminCredentials.username, username));
    const valid = await verifyPassword(
      data.password,
      row?.credential.passwordHash || dummy,
    );
    if (!valid || !row || row.user.disabled || !roles.includes(row.user.role))
      throw new AppError(401, "INVALID_CREDENTIALS");
    await createSession(row.user.id, true);
    await audit(row.user.id, "admin.password_login");
    return {
      ok: true,
      mfaRequired: row.credential.smsEnabled || row.credential.totpEnabled,
    };
  }
  if (action === "status" && method === "GET") {
    const { auth, credential } = await context();
    return {
      username: credential.username,
      smsEnabled: credential.smsEnabled,
      totpEnabled: credential.totpEnabled,
      totpConfigured: !!credential.totpSecret,
      mfaRequired: !isMfaCurrent(auth.mfaVerifiedAt),
      role: auth.user.role,
    };
  }
  if (action === "sms" && method === "POST") {
    const ctx = await context();
    if (!ctx.credential.smsEnabled) throw new AppError(403, "METHOD_DISABLED");
    await issueSms(ctx);
    return { ok: true };
  }
  if (action === "verify" && method === "POST") {
    const ctx = await context();
    const data = z
      .object({ method: z.enum(["sms", "totp"]), code: codeSchema })
      .parse(input);
    await rateLimit(`admin-mfa:${ctx.auth.user.id}`, 10, 300);
    if (data.method === "sms") {
      if (!ctx.credential.smsEnabled)
        throw new AppError(403, "METHOD_DISABLED");
      await consumeSms(ctx.sessionHash, data.code);
    } else {
      if (!ctx.credential.totpEnabled || !ctx.credential.totpSecret)
        throw new AppError(403, "METHOD_DISABLED");
      const counter = totpCounter(
        decryptSecret(ctx.credential.totpSecret, settingsKey()),
        data.code,
      );
      if (counter === null) throw new AppError(400, "INVALID_OTP");
      const used = await db
        .insert(rateLimits)
        .values({
          key: `admin-totp-used:${ctx.auth.user.id}:${counter}`,
          count: 1,
          resetsAt: new Date(Date.now() + 120000),
        })
        .onConflictDoNothing()
        .returning();
      if (!used.length) throw new AppError(400, "INVALID_OTP");
    }
    await db
      .update(sessions)
      .set({ mfaVerifiedAt: new Date() })
      .where(eq(sessions.tokenHash, ctx.sessionHash));
    await audit(ctx.auth.user.id, "admin.mfa_verified");
    return { ok: true };
  }
  await requireUser(true);
  if (action === "account" && method === "POST") {
    const owner = await requireUser(true);
    if (owner.role !== "super_admin") throw new AppError(403, "FORBIDDEN");
    const data = z
      .object({
        currentPassword: passwordSchema,
        name: z.string().trim().min(2).max(100),
        phone: z.string().regex(/^09\d{9}$/),
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9._-]{3,64}$/),
        password: z.string().min(12).max(128),
        role: z.enum(["staff", "doctor", "super_admin"]),
      })
      .parse(input);
    await confirmPassword(data.currentPassword);
    await rateLimit(`admin-account-create:${owner.id}`, 5, 900);
    const passwordHash = await hashPassword(data.password);
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(users)
        .where(eq(users.phone, data.phone));
      // Existing administrators must use their own password-change flow.
      if (existing && existing.role !== "patient")
        throw new AppError(409, "ACCOUNT_EXISTS");
      const [account] = await tx
        .insert(users)
        .values({ name: data.name, phone: data.phone, role: data.role })
        .onConflictDoUpdate({
          target: users.phone,
          set: {
            name: data.name,
            role: data.role,
            disabled: false,
            updatedAt: new Date(),
          },
        })
        .returning();
      await tx
        .insert(adminCredentials)
        .values({ userId: account.id, username: data.username, passwordHash });
      await tx.delete(sessions).where(eq(sessions.userId, account.id));
      await tx.insert(auditLogs).values({
        actorId: owner.id,
        action: "admin.account_created",
        entityType: "user",
        entityId: account.id,
        metadata: { role: data.role },
      });
    });
    return { ok: true, username: data.username };
  }
  if (action === "totp-setup" && method === "POST") {
    const data = z.object({ currentPassword: passwordSchema }).parse(input);
    const ctx = await confirmPassword(data.currentPassword);
    await rateLimit(`admin-totp-setup:${ctx.auth.user.id}`, 5, 600);
    const secret = newTotpSecret();
    await db
      .update(adminCredentials)
      .set({
        pendingTotpSecret: encryptSecret(secret, settingsKey()),
        updatedAt: new Date(),
      })
      .where(eq(adminCredentials.userId, ctx.auth.user.id));
    return {
      secret,
      uri: `otpauth://totp/DrSobhanSaki:${encodeURIComponent(ctx.credential.username)}?secret=${secret}&issuer=DrSobhanSaki&algorithm=SHA1&digits=6&period=30`,
    };
  }
  if (action === "sms-setup" && method === "POST") {
    const data = z.object({ currentPassword: passwordSchema }).parse(input);
    const ctx = await confirmPassword(data.currentPassword);
    await issueSms(ctx);
    return { ok: true };
  }
  if (action === "policy" && method === "PUT") {
    const data = z
      .object({
        currentPassword: passwordSchema,
        smsEnabled: z.boolean(),
        totpEnabled: z.boolean(),
        smsCode: codeSchema.optional(),
        totpCode: codeSchema.optional(),
      })
      .parse(input);
    const ctx = await confirmPassword(data.currentPassword);
    await rateLimit(`admin-policy:${ctx.auth.user.id}`, 10, 600);
    let secret = ctx.credential.totpSecret;
    if (data.smsEnabled && !ctx.credential.smsEnabled) {
      if (!data.smsCode) throw new AppError(400, "VERIFY_SMS_FIRST");
      await consumeSms(ctx.sessionHash, data.smsCode);
    }
    if (
      data.totpEnabled &&
      (!ctx.credential.totpEnabled || ctx.credential.pendingTotpSecret)
    ) {
      secret = ctx.credential.pendingTotpSecret || secret;
      if (
        !secret ||
        !data.totpCode ||
        totpCounter(decryptSecret(secret, settingsKey()), data.totpCode) ===
          null
      )
        throw new AppError(400, "VERIFY_TOTP_FIRST");
    }
    await db.transaction(async (tx) => {
      await tx
        .update(adminCredentials)
        .set({
          smsEnabled: data.smsEnabled,
          totpEnabled: data.totpEnabled,
          totpSecret: secret,
          pendingTotpSecret: null,
          updatedAt: new Date(),
        })
        .where(eq(adminCredentials.userId, ctx.auth.user.id));
      await tx
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, ctx.auth.user.id),
            ne(sessions.tokenHash, ctx.sessionHash),
          ),
        );
      await tx
        .update(sessions)
        .set({ mfaVerifiedAt: new Date() })
        .where(eq(sessions.tokenHash, ctx.sessionHash));
      await tx.insert(auditLogs).values({
        actorId: ctx.auth.user.id,
        action: "admin.login_policy_changed",
        entityType: "admin_security",
        entityId: ctx.auth.user.id,
        metadata: {
          smsEnabled: data.smsEnabled,
          totpEnabled: data.totpEnabled,
        },
      });
    });
    return { ok: true };
  }
  if (action === "password" && method === "PUT") {
    const data = z
      .object({
        currentPassword: passwordSchema,
        newPassword: z.string().min(12).max(128),
      })
      .parse(input);
    const ctx = await confirmPassword(data.currentPassword);
    const { hashPassword } = await import("@/lib/admin-crypto");
    await db.transaction(async (tx) => {
      await tx
        .update(adminCredentials)
        .set({
          passwordHash: await hashPassword(data.newPassword),
          updatedAt: new Date(),
        })
        .where(eq(adminCredentials.userId, ctx.auth.user.id));
      await tx
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, ctx.auth.user.id),
            ne(sessions.tokenHash, ctx.sessionHash),
          ),
        );
    });
    await audit(ctx.auth.user.id, "admin.password_changed");
    return { ok: true };
  }
  if (action === "patient-login-mode" && method === "PUT") {
    const user = await requireUser(true);
    if (user.role !== "super_admin") throw new AppError(403, "FORBIDDEN");
    const data = z
      .object({ currentPassword: passwordSchema, enabled: z.boolean() })
      .parse(input);
    await confirmPassword(data.currentPassword);
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('patient-login-mode'))`,
      );
      const previous = await patientTestMode(tx);
      await tx
        .insert(websiteSettings)
        .values({ key: "patientTestLogin", value: { enabled: data.enabled } })
        .onConflictDoUpdate({
          target: websiteSettings.key,
          set: { value: { enabled: data.enabled }, updatedAt: new Date() },
        });
      if (previous !== data.enabled) {
        await tx
          .update(otpChallenges)
          .set({ consumedAt: new Date() })
          .where(isNull(otpChallenges.consumedAt));
        await tx
          .delete(sessions)
          .where(
            inArray(
              sessions.userId,
              tx
                .select({ id: users.id })
                .from(users)
                .where(eq(users.role, "patient")),
            ),
          );
      }
      await tx
        .insert(auditLogs)
        .values({
          actorId: user.id,
          action: "admin.patient_login_mode_changed",
          entityType: "setting",
          entityId: "patientTestLogin",
          metadata: { enabled: data.enabled },
        });
    });
    return { ok: true };
  }
  if (action === "sms-settings") {
    const user = await requireUser(true);
    if (user.role !== "super_admin") throw new AppError(403, "FORBIDDEN");
    if (method === "GET") {
      const saved = await storedSmsSettings();
      return {
        configured: !!saved,
        username: saved?.username || "",
        otpBodyId: saved?.otpBodyId || "",
        from: saved?.from || "",
        passwordConfigured: !!saved?.password,
        patientTestMode: await patientTestMode(),
      };
    }
    if (method === "PUT") {
      const data = z
        .object({
          currentPassword: passwordSchema,
          username: z.string().trim().min(1).max(128),
          password: z.string().max(256).optional(),
          otpBodyId: z.string().regex(/^\d+$/),
          from: z.string().max(32).default(""),
        })
        .parse(input);
      await confirmPassword(data.currentPassword);
      const previous = await storedSmsSettings();
      const password = data.password || previous?.password;
      if (!password) throw new AppError(400, "SMS_NOT_CONFIGURED");
      const testMode = await patientTestMode();
      await db
        .insert(websiteSettings)
        .values({ key: "patientTestLogin", value: { enabled: testMode } })
        .onConflictDoNothing();
      await saveSmsSettings({
        username: data.username,
        password,
        otpBodyId: data.otpBodyId,
        from: data.from,
      });
      await audit(user.id, "admin.sms_settings_changed");
      return { ok: true };
    }
    if (method === "POST") {
      await rateLimit(`sms-test:${user.id}`, 3, 600);
      const code = String(randomInt(100000, 1000000));
      await sendSms(user.phone, `آزمون پیامک: ${code}`, code);
      return { ok: true };
    }
  }
  throw new AppError(404, "NOT_FOUND");
}
