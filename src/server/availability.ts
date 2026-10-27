import "server-only";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { appointmentSlots, consultationTypes } from "@/db/schema";

// Expiry is checked synchronously as well as by cron so a stale hold cannot block a slot all day.
export async function expireBookingHolds() {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('doctor-schedule'))`,
    );
    await tx.execute(sql`with expired as (
      update appointments set status='expired', payment_status='expired', updated_at=now()
      where status='awaiting_payment' and expires_at<=now()
      and not exists (select 1 from payment_submissions p join payment_receipts r on r.submission_id=p.id
        where p.appointment_id=appointments.id and r.verification_status='pending_upload' and r.upload_expires_at>now())
      returning id, patient_id
    ) insert into appointment_status_history (appointment_id,actor_id,from_state,to_state,note)
      select id,patient_id,'awaiting_payment','expired','System: unpaid reservation expired' from expired`);
  });
}
export async function availableSlots() {
  return getDb()
    .select({
      id: appointmentSlots.id,
      consultationTypeId: appointmentSlots.consultationTypeId,
      startsAt: appointmentSlots.startsAt,
      endsAt: appointmentSlots.endsAt,
    })
    .from(appointmentSlots)
    .innerJoin(
      consultationTypes,
      eq(consultationTypes.id, appointmentSlots.consultationTypeId),
    )
    .where(
      and(
        eq(appointmentSlots.enabled, true),
        eq(consultationTypes.enabled, true),
        gt(appointmentSlots.startsAt, new Date()),
        sql`${appointmentSlots.endsAt} >= ${appointmentSlots.startsAt} + ${consultationTypes.durationMinutes} * interval '1 minute'`,
        sql`not exists (
    select 1 from blocked_dates b where b.starts_at < ${appointmentSlots.endsAt} and b.ends_at > ${appointmentSlots.startsAt}
  )`,
        sql`not exists (
    select 1 from appointments a join appointment_slots occupied on occupied.id=a.slot_id
    join consultation_types booked_type on booked_type.id=a.consultation_type_id
    where a.status not in ('cancelled','rejected','expired')
    and occupied.starts_at < ${appointmentSlots.endsAt} + greatest(${consultationTypes.bufferMinutes},booked_type.buffer_minutes)*interval '1 minute'
    and occupied.ends_at > ${appointmentSlots.startsAt} - greatest(${consultationTypes.bufferMinutes},booked_type.buffer_minutes)*interval '1 minute'
  )`,
      ),
    )
    .orderBy(asc(appointmentSlots.startsAt))
    .limit(1000);
}
