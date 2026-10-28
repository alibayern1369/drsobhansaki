import "server-only";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appointments,
  appointmentSlots,
  notifications,
  users,
  smsTemplates,
} from "@/db/schema";
import { sendSms } from "./sms";
import { expireBookingHolds } from "./availability";
import {
  isSmsEvent,
  renderSms,
  smsVariables,
  smsWorkflows,
  reminderIsCurrent,
} from "@/lib/sms-workflow";

async function enqueueReminders() {
  // The unique key includes the slot time, so concurrent runs cannot duplicate
  // a reminder and a rescheduled appointment gets its own reminder.
  await getDb().execute(sql`
    insert into notifications (user_id, appointment_id, event, dedupe_key)
    select a.patient_id, a.id, 'appointment_reminder',
      'reminder:' || a.id::text || ':' || extract(epoch from sl.starts_at)::text || ':' || a.patient_id::text
    from appointments a join appointment_slots sl on sl.id = a.slot_id
    where a.status = 'confirmed' and a.payment_status = 'approved'
      and sl.starts_at > now() and sl.starts_at <= now() + interval '15 minutes'
    on conflict (dedupe_key) do nothing
  `);
  await getDb().execute(sql`
    insert into notifications (user_id, appointment_id, event, dedupe_key)
    select u.id, a.id, 'doctor_appointment_reminder',
      'doctor-reminder:' || a.id::text || ':' || extract(epoch from sl.starts_at)::text || ':' || u.id::text
    from appointments a join appointment_slots sl on sl.id = a.slot_id
    cross join users u
    where a.status = 'confirmed' and a.payment_status = 'approved'
      and sl.starts_at > now() and sl.starts_at <= now() + interval '15 minutes'
      and u.role in ('doctor', 'super_admin') and u.disabled = false
    on conflict (dedupe_key) do nothing
  `);
}
export async function runJobs(appointmentId?: string, notificationId?: string) {
  const db = getDb();
  await expireBookingHolds();
  if (!appointmentId && !notificationId) await enqueueReminders();
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
          inArray(notifications.event, Object.keys(smsWorkflows)),
          lte(notifications.nextAttemptAt, new Date()),
          appointmentId
            ? eq(notifications.appointmentId, appointmentId)
            : sql`true`,
          notificationId ? eq(notifications.id, notificationId) : sql`true`,
        ),
      )
      .orderBy(
        sql`case when ${notifications.event} in ('appointment_reminder', 'doctor_appointment_reminder') then 0 else 1 end`,
        notifications.nextAttemptAt,
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
  for (const n of claimed) {
    try {
      if (!isSmsEvent(n.event)) {
        await db
          .update(notifications)
          .set({ status: "skipped", lastError: "IN_APP_ONLY" })
          .where(eq(notifications.id, n.id));
        continue;
      }
      const [user] = await db
        .select({
          phone: users.phone,
          disabled: users.disabled,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, n.userId));
      const [template] = await db
        .select()
        .from(smsTemplates)
        .where(eq(smsTemplates.key, n.event));
      if (!user || user.disabled) throw new Error("NOTIFICATION_USER_MISSING");
      if (
        n.event.startsWith("doctor_") &&
        !["doctor", "super_admin"].includes(user.role)
      )
        throw new Error("NOTIFICATION_ROLE_CHANGED");
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
      const content = template?.content as
        { fa?: string; patternId?: string } | undefined;
      const [appointment] = await db
        .select({
          startsAt: appointmentSlots.startsAt,
          type: appointments.typeSnapshot,
          trackingCode: appointments.trackingCode,
          status: appointments.status,
          paymentStatus: appointments.paymentStatus,
          patientName: users.name,
          patientPhone: users.phone,
          patientId: appointments.patientId,
          slotEpoch: sql<string>`extract(epoch from ${appointmentSlots.startsAt})::text`,
        })
        .from(appointments)
        .innerJoin(users, eq(users.id, appointments.patientId))
        .leftJoin(
          appointmentSlots,
          eq(appointmentSlots.id, appointments.slotId),
        )
        .where(eq(appointments.id, n.appointmentId!));
      if (!appointment) throw new Error("NOTIFICATION_APPOINTMENT_MISSING");
      if (!n.event.startsWith("doctor_") && appointment.patientId !== n.userId)
        throw new Error("NOTIFICATION_OWNER_MISMATCH");
      const reminder = n.event.endsWith("reminder");
      if (
        ((n.event === "appointment_confirmed" || reminder) &&
          (!["confirmed", "in_progress", "completed"].includes(
            appointment.status,
          ) ||
            appointment.paymentStatus !== "approved")) ||
        (reminder &&
          !reminderIsCurrent({
            ...appointment,
            dedupeKey: n.dedupeKey,
            userId: n.userId,
          })) ||
        ["cancelled", "expired"].includes(appointment.status)
      ) {
        await db
          .update(notifications)
          .set({ status: "skipped", lastError: "APPOINTMENT_NOT_CONFIRMED" })
          .where(eq(notifications.id, n.id));
        continue;
      }
      if (!content?.patternId || !/^\d+$/.test(content.patternId)) {
        await db
          .update(notifications)
          .set({
            status: "failed",
            lastError: "SMS_PATTERN_NOT_CONFIGURED",
          })
          .where(eq(notifications.id, n.id));
        continue;
      }
      const values = smsVariables({
        name: appointment.patientName,
        phone: appointment.patientPhone,
        startsAt: appointment.startsAt,
        trackingCode: appointment.trackingCode,
      });
      const workflow = smsWorkflows[n.event];
      const result = await sendSms(
        user.phone,
        renderSms(n.event, values, content.fa),
        undefined,
        {
          bodyId: content.patternId,
          values: workflow.variables.map((key) =>
            values[key].replace(/[;\r\n]/g, " "),
          ),
        },
      );
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
          status:
            n.attempts + 1 >= 5 ||
            (error instanceof Error &&
              error.message === "SMS_DELIVERY_OUTCOME_UNKNOWN")
              ? "failed"
              : "pending",
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
