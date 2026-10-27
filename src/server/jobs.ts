import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appointments,
  appointmentSlots,
  notifications,
  users,
  smsTemplates,
  websiteSettings,
} from "@/db/schema";
import { sendSms } from "./sms";
import { expireBookingHolds } from "./availability";
import { appointmentConfirmationMessage } from "@/lib/notification-message";
export async function runJobs(appointmentId?: string, notificationId?: string) {
  const db = getDb();
  await expireBookingHolds();
  // An interrupted provider call has an unknown delivery outcome. Keep it visible
  // for manual review rather than silently duplicating a potentially delivered SMS.
  await db
    .update(notifications)
    .set({ status: "failed", lastError: "SMS_DELIVERY_OUTCOME_UNKNOWN" })
    .where(
      and(
        eq(notifications.status, "sending"),
        lte(notifications.nextAttemptAt, new Date()),
        sql`${notifications.createdAt} < now() - interval '10 minutes'`,
      ),
    );
  const claimed = await db.transaction(async (tx) => {
    const batch = await tx
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.status, "pending"),
          lte(notifications.nextAttemptAt, new Date()),
          appointmentId
            ? eq(notifications.appointmentId, appointmentId)
            : sql`true`,
          notificationId ? eq(notifications.id, notificationId) : sql`true`,
        ),
      )
      .limit(4)
      .for("update", { skipLocked: true });
    for (const n of batch)
      await tx
        .update(notifications)
        .set({
          status: "sending",
          attempts: n.attempts + 1,
          nextAttemptAt: new Date(Date.now() + 10 * 60000),
        })
        .where(eq(notifications.id, n.id));
    return batch;
  });
  let sent = 0;
  let failed = 0;
  const [seo] = claimed.length
    ? await db
        .select({ value: websiteSettings.value })
        .from(websiteSettings)
        .where(eq(websiteSettings.key, "seo"))
    : [];
  const siteUrl =
    (seo?.value as { siteUrl?: string } | undefined)?.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://drsobhansaki.vercel.app";
  for (const n of claimed) {
    try {
      const [user] = await db
        .select({ phone: users.phone })
        .from(users)
        .where(eq(users.id, n.userId));
      const [template] = await db
        .select()
        .from(smsTemplates)
        .where(eq(smsTemplates.key, n.event));
      if (!user) throw new Error("NOTIFICATION_USER_MISSING");
      if (template && !template.enabled) {
        await db
          .update(notifications)
          .set({
            status: "skipped",
            lastError: "SMS_TEMPLATE_DISABLED_OR_MISSING",
          })
          .where(eq(notifications.id, n.id));
        continue;
      }
      let message = (template?.content as { fa?: string } | undefined)?.fa;
      if (n.event === "appointment_confirmed") {
        const [appointment] = await db
          .select({
            startsAt: appointmentSlots.startsAt,
            type: appointments.typeSnapshot,
            trackingCode: appointments.trackingCode,
            status: appointments.status,
            paymentStatus: appointments.paymentStatus,
          })
          .from(appointments)
          .innerJoin(
            appointmentSlots,
            eq(appointmentSlots.id, appointments.slotId),
          )
          .where(eq(appointments.id, n.appointmentId!));
        if (
          !appointment ||
          !["confirmed", "in_progress", "completed"].includes(
            appointment.status,
          ) ||
          appointment.paymentStatus !== "approved"
        ) {
          await db
            .update(notifications)
            .set({ status: "skipped", lastError: "APPOINTMENT_NOT_CONFIRMED" })
            .where(eq(notifications.id, n.id));
          continue;
        }
        message = appointmentConfirmationMessage(
          {
            startsAt: appointment.startsAt,
            type: (appointment.type as { key: string }).key,
            trackingCode: appointment.trackingCode,
            siteUrl,
          },
          message,
        );
      }
      if (!message) {
        await db
          .update(notifications)
          .set({
            status: "skipped",
            lastError: "SMS_TEMPLATE_DISABLED_OR_MISSING",
          })
          .where(eq(notifications.id, n.id));
        continue;
      }
      const result = await sendSms(user.phone, message);
      if (result.id === "development-no-delivery")
        throw new Error("DEVELOPMENT_NO_SMS_DELIVERY");
      await db
        .update(notifications)
        .set({ status: "sent", providerId: result.id, lastError: null })
        .where(eq(notifications.id, n.id));
      sent++;
    } catch (error) {
      await db
        .update(notifications)
        .set({
          status: n.attempts + 1 >= 5 ? "failed" : "pending",
          lastError:
            error instanceof Error && /^[A-Z_]+$/.test(error.message)
              ? error.message
              : "SMS_DELIVERY_FAILED",
          nextAttemptAt: new Date(
            Date.now() + Math.min(3600000, 60000 * 2 ** n.attempts),
          ),
        })
        .where(eq(notifications.id, n.id));
      failed++;
    }
  }
  return { sent, failed };
}
