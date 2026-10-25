import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appointments,
  consultationTypes,
  messagingPlatforms,
  appointmentSlots,
  appointmentStatusHistory,
  notifications,
  paymentVerificationEvents,
  paymentSubmissions,
  paymentReceipts,
  websiteSettings,
  blockedDates,
  auditLogs,
} from "@/db/schema";
import {
  assertTransition,
  bookingSchema,
  canVerifyPayment,
} from "@/lib/domain";
import { AppError, requireUser } from "./security";
export async function bookAppointment(input: unknown) {
  const user = await requireUser();
  const data = bookingSchema.parse(input);
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${user.id + data.idempotencyKey}))`,
    );
    const [existing] = await tx
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, user.id),
          eq(appointments.idempotencyKey, data.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) return existing;
    const [settings] = await tx
      .select()
      .from(websiteSettings)
      .where(eq(websiteSettings.key, "booking"));
    const config = settings?.value as
      | {
          enabled?: boolean;
          patientScheduling?: boolean;
          doctorScheduling?: boolean;
        }
      | undefined;
    if (!config?.enabled || !config[`${data.schedulingMode}Scheduling`])
      throw new AppError(503, "BOOKING_NOT_OPEN");
    const [type] = await tx
      .select()
      .from(consultationTypes)
      .where(
        and(
          eq(consultationTypes.id, data.consultationTypeId),
          eq(consultationTypes.enabled, true),
        ),
      )
      .limit(1);
    if (!type) throw new AppError(400, "CONSULTATION_UNAVAILABLE");
    let platform = null;
    if (type.key === "text") {
      if (!data.platformId) throw new AppError(400, "PLATFORM_REQUIRED");
      const [p] = await tx
        .select()
        .from(messagingPlatforms)
        .where(
          and(
            eq(messagingPlatforms.id, data.platformId),
            eq(messagingPlatforms.enabled, true),
          ),
        )
        .limit(1);
      if (!p) throw new AppError(400, "PLATFORM_UNAVAILABLE");
      platform = {
        key: p.key,
        link: p.link,
        contactNumber: p.contactNumber,
        username: p.username,
        instructions: p.instructions,
      };
    }
    if (data.schedulingMode === "patient") {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('doctor-schedule'))`,
      );
      const [slot] = await tx
        .select()
        .from(appointmentSlots)
        .where(
          and(
            eq(appointmentSlots.id, data.slotId!),
            eq(appointmentSlots.consultationTypeId, type.id),
            eq(appointmentSlots.enabled, true),
            gt(appointmentSlots.startsAt, new Date()),
          ),
        )
        .for("update");
      if (!slot) throw new AppError(409, "SLOT_UNAVAILABLE");
      const blocked = await tx
        .select({ id: blockedDates.id })
        .from(blockedDates)
        .where(
          and(
            lt(blockedDates.startsAt, slot.endsAt),
            gt(blockedDates.endsAt, slot.startsAt),
          ),
        )
        .limit(1);
      if (blocked.length) throw new AppError(409, "SLOT_UNAVAILABLE");
      const conflicts = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .innerJoin(
          appointmentSlots,
          eq(appointmentSlots.id, appointments.slotId),
        )
        .where(
          and(
            lt(
              appointmentSlots.startsAt,
              new Date(slot.endsAt.getTime() + type.bufferMinutes * 60000),
            ),
            gt(
              appointmentSlots.endsAt,
              new Date(slot.startsAt.getTime() - type.bufferMinutes * 60000),
            ),
            ne(appointments.status, "cancelled"),
            ne(appointments.status, "rejected"),
            ne(appointments.status, "expired"),
          ),
        )
        .limit(1);
      if (conflicts.length) throw new AppError(409, "SLOT_UNAVAILABLE");
    }
    const [appointment] = await tx
      .insert(appointments)
      .values({
        patientId: user.id,
        consultationTypeId: type.id,
        typeSnapshot: {
          key: type.key,
          name: type.name,
          instructions: type.instructions,
        },
        platformSnapshot: platform,
        priceRial: type.priceRial,
        durationMinutes: type.durationMinutes,
        slotId: data.schedulingMode === "patient" ? data.slotId : null,
        schedulingMode: data.schedulingMode,
        trackingCode: randomBytes(12).toString("hex").toUpperCase(),
        idempotencyKey: data.idempotencyKey,
        expiresAt: new Date(Date.now() + 30 * 60000),
        consentAt: new Date(),
      })
      .returning();
    await tx.insert(appointmentStatusHistory).values({
      appointmentId: appointment.id,
      actorId: user.id,
      toState: "awaiting_payment",
    });
    await tx.insert(notifications).values({
      userId: user.id,
      appointmentId: appointment.id,
      event: "booking_submitted",
      dedupeKey: `booking:${appointment.id}`,
    });
    return appointment;
  });
}
export async function reviewPayment(
  id: string,
  data: {
    action: "approve" | "reject" | "request_information";
    bankDepositVerified?: boolean;
    note?: string;
    idempotencyKey: string;
  },
) {
  const user = await requireUser(true);
  if (!canVerifyPayment(user.role)) throw new AppError(403, "FORBIDDEN");
  if (data.action === "approve" && !data.bankDepositVerified)
    throw new AppError(400, "BANK_VERIFICATION_REQUIRED");
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('receipt-cleanup'))`,
    );
    const [existing] = await tx
      .select()
      .from(paymentVerificationEvents)
      .where(eq(paymentVerificationEvents.idempotencyKey, data.idempotencyKey));
    if (existing) {
      if (
        existing.appointmentId !== id ||
        existing.actorId !== user.id ||
        existing.action !== data.action
      )
        throw new AppError(409, "IDEMPOTENCY_CONFLICT");
      return { ok: true };
    }
    const [a] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .for("update");
    if (!a) throw new AppError(404, "NOT_FOUND");
    if (["cancelled", "expired", "rejected"].includes(a.status))
      throw new AppError(409, "INVALID_TRANSITION");
    if (a.paymentStatus !== "under_review")
      throw new AppError(409, "INVALID_TRANSITION");
    const paymentStatus =
      data.action === "approve"
        ? "approved"
        : data.action === "reject"
          ? "rejected"
          : "additional_information_required";
    assertTransition("payment", a.paymentStatus, paymentStatus);
    const status =
      data.action === "approve"
        ? a.slotId
          ? "confirmed"
          : "awaiting_scheduling"
        : "awaiting_verification";
    assertTransition("appointment", a.status, status);
    const reviewedPayments = await tx
      .update(paymentSubmissions)
      .set({ status: paymentStatus })
      .where(
        and(
          eq(paymentSubmissions.appointmentId, id),
          eq(paymentSubmissions.status, "under_review"),
        ),
      )
      .returning({ id: paymentSubmissions.id });
    if (!reviewedPayments.length) throw new AppError(409, "INVALID_TRANSITION");
    await tx
      .update(paymentReceipts)
      .set({ verificationStatus: paymentStatus })
      .where(
        and(
          inArray(
            paymentReceipts.paymentId,
            reviewedPayments.map((p) => p.id),
          ),
          eq(paymentReceipts.verificationStatus, "under_review"),
        ),
      );
    await tx
      .update(appointments)
      .set({
        paymentStatus,
        status,
        confirmedAt: status === "confirmed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id));
    await tx.insert(paymentVerificationEvents).values({
      appointmentId: id,
      actorId: user.id,
      action: data.action,
      bankDepositVerified: !!data.bankDepositVerified,
      note: data.note,
      idempotencyKey: data.idempotencyKey,
    });
    await tx.insert(appointmentStatusHistory).values({
      appointmentId: id,
      actorId: user.id,
      fromState: a.status,
      toState: status,
    });
    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: `payment.${data.action}`,
      entityType: "appointment",
      entityId: id,
    });
    await tx.insert(notifications).values({
      userId: a.patientId,
      appointmentId: id,
      event: `payment_${paymentStatus}`,
      dedupeKey: `payment:${data.idempotencyKey}`,
    });
    return { ok: true };
  });
}
export async function assignSlot(id: string, slotId: string) {
  const user = await requireUser(true);
  if (!canVerifyPayment(user.role)) throw new AppError(403, "FORBIDDEN");
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('doctor-schedule'))`,
    );
    const [a] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .for("update");
    if (!a) throw new AppError(404, "NOT_FOUND");
    if (
      a.paymentStatus !== "approved" ||
      !["awaiting_scheduling", "confirmed"].includes(a.status)
    )
      throw new AppError(409, "INVALID_TRANSITION");
    const [slot] = await tx
      .select()
      .from(appointmentSlots)
      .where(
        and(
          eq(appointmentSlots.id, slotId),
          eq(appointmentSlots.consultationTypeId, a.consultationTypeId),
          eq(appointmentSlots.enabled, true),
          gt(appointmentSlots.startsAt, new Date()),
        ),
      )
      .for("update");
    if (!slot) throw new AppError(409, "SLOT_UNAVAILABLE");
    const blocked = await tx
      .select({ id: blockedDates.id })
      .from(blockedDates)
      .where(
        and(
          lt(blockedDates.startsAt, slot.endsAt),
          gt(blockedDates.endsAt, slot.startsAt),
        ),
      )
      .limit(1);
    if (blocked.length) throw new AppError(409, "SLOT_UNAVAILABLE");
    const conflict = await tx
      .select({ id: appointments.id })
      .from(appointments)
      .innerJoin(appointmentSlots, eq(appointmentSlots.id, appointments.slotId))
      .where(
        and(
          ne(appointments.id, id),
          lt(appointmentSlots.startsAt, slot.endsAt),
          gt(appointmentSlots.endsAt, slot.startsAt),
          inArray(appointments.status, [
            "awaiting_payment",
            "awaiting_verification",
            "awaiting_scheduling",
            "confirmed",
            "in_progress",
          ]),
        ),
      )
      .limit(1);
    if (conflict.length) throw new AppError(409, "SLOT_UNAVAILABLE");
    if (a.slotId === slotId && a.status === "confirmed") return { ok: true };
    await tx
      .update(appointments)
      .set({
        slotId,
        status: "confirmed",
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id));
    await tx.insert(appointmentStatusHistory).values({
      appointmentId: id,
      actorId: user.id,
      fromState: a.status,
      toState: "confirmed",
      note: "Schedule assigned or updated",
    });
    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: "appointment.schedule",
      entityType: "appointment",
      entityId: id,
    });
    await tx
      .insert(notifications)
      .values({
        userId: a.patientId,
        appointmentId: id,
        event: "appointment_confirmed",
        dedupeKey: `schedule:${id}:${slotId}`,
      })
      .onConflictDoNothing();
    return { ok: true };
  });
}
