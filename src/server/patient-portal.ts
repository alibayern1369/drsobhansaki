import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { patientAppointmentView } from "@/lib/booking-flow";
import { AppError, requireUser } from "./security";

export async function patientOperation(
  request: Request,
  path: string[],
  method: string,
) {
  if (path[0] !== "patient") return null;
  const user = await requireUser();
  const db = getDb();
  const json = (data: unknown) =>
    Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  if (path[1] === "support" && method === "GET") {
    const rows = await db
      .select({ key: s.websiteSettings.key, value: s.websiteSettings.value })
      .from(s.websiteSettings)
      .where(sql`${s.websiteSettings.key} in ('contact','social')`);
    const contact = (rows.find((r) => r.key === "contact")?.value || {}) as {
      phone?: string;
      email?: string;
    };
    return json({ phone: contact.phone || null, email: contact.email || null });
  }
  if (
    path[1] === "appointments" &&
    path[3] === "release" &&
    method === "POST"
  ) {
    const id = z.uuid().parse(path[2]);
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('doctor-schedule'))`,
      );
      const [a] = await tx
        .select()
        .from(s.appointments)
        .where(
          and(eq(s.appointments.id, id), eq(s.appointments.patientId, user.id)),
        )
        .for("update");
      if (!a) throw new AppError(404, "NOT_FOUND");
      if (a.status === "cancelled") return;
      if (
        a.status !== "awaiting_payment" ||
        a.paymentStatus !== "awaiting_payment"
      )
        throw new AppError(409, "INVALID_TRANSITION");
      const [upload] = await tx
        .select({ id: s.paymentSubmissions.id })
        .from(s.paymentSubmissions)
        .where(eq(s.paymentSubmissions.appointmentId, id))
        .limit(1);
      if (upload) throw new AppError(409, "INVALID_TRANSITION");
      await tx
        .update(s.appointments)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(s.appointments.id, id));
      await tx.insert(s.appointmentStatusHistory).values({
        appointmentId: id,
        actorId: user.id,
        fromState: a.status,
        toState: "cancelled",
        note: "Patient returned to time selection before payment",
      });
    });
    return json({ ok: true });
  }
  if (path[1] === "profile") {
    if (method === "GET")
      return json({ id: user.id, name: user.name, phone: user.phone });
    if (method === "PUT") {
      const input = z
        .object({
          name: z.string().trim().min(3).max(100),
          locale: z.enum(["fa", "en"]),
        })
        .parse(await request.json());
      await db.transaction(async (tx) => {
        await tx
          .update(s.users)
          .set({ name: input.name, updatedAt: new Date() })
          .where(eq(s.users.id, user.id));
        await tx
          .insert(s.patientProfiles)
          .values({ userId: user.id, locale: input.locale })
          .onConflictDoUpdate({
            target: s.patientProfiles.userId,
            set: { locale: input.locale, updatedAt: new Date() },
          });
        await tx.insert(s.auditLogs).values({
          actorId: user.id,
          action: "patient.profile_update",
          entityType: "user",
          entityId: user.id,
        });
      });
      return json({ id: user.id, name: input.name, phone: user.phone });
    }
  }
  if (path[1] === "notifications") {
    if (method === "GET") {
      const items = await db
        .select({
          id: s.notifications.id,
          appointmentId: s.notifications.appointmentId,
          event: s.notifications.event,
          readAt: s.notifications.readAt,
          createdAt: s.notifications.createdAt,
        })
        .from(s.notifications)
        .where(eq(s.notifications.userId, user.id))
        .orderBy(desc(s.notifications.createdAt))
        .limit(100);
      const [count] = await db
        .select({ unread: sql<number>`count(*)::int` })
        .from(s.notifications)
        .where(
          and(
            eq(s.notifications.userId, user.id),
            isNull(s.notifications.readAt),
          ),
        );
      return json({ items, unread: count.unread });
    }
    if (method === "POST") {
      const { id } = z.object({ id: z.uuid() }).parse(await request.json());
      const rows = await db
        .update(s.notifications)
        .set({ readAt: new Date() })
        .where(
          and(eq(s.notifications.id, id), eq(s.notifications.userId, user.id)),
        )
        .returning({ id: s.notifications.id });
      if (!rows.length) throw new AppError(404, "NOT_FOUND");
      return json({ ok: true });
    }
  }
  if (path[1] === "summary" && method === "GET") {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        confirmed: sql<number>`count(*) filter (where ${s.appointments.status}='confirmed')::int`,
        pending: sql<number>`count(*) filter (where ${s.appointments.status} in ('awaiting_payment','awaiting_verification','awaiting_scheduling'))::int`,
        completed: sql<number>`count(*) filter (where ${s.appointments.status}='completed')::int`,
      })
      .from(s.appointments)
      .where(eq(s.appointments.patientId, user.id));
    const next = await db
      .select({
        ...getTableColumns(s.appointments),
        startsAt: s.appointmentSlots.startsAt,
      })
      .from(s.appointments)
      .innerJoin(
        s.appointmentSlots,
        eq(s.appointmentSlots.id, s.appointments.slotId),
      )
      .where(
        and(
          eq(s.appointments.patientId, user.id),
          eq(s.appointments.status, "confirmed"),
          sql`${s.appointmentSlots.startsAt}>now()`,
        ),
      )
      .orderBy(asc(s.appointmentSlots.startsAt))
      .limit(1);
    return json({
      user: { name: user.name, phone: user.phone },
      stats,
      next: next[0] ? patientAppointmentView(next[0]) : null,
    });
  }
  if (path[1] === "appointments" && method === "GET") {
    const id = path[2] ? z.uuid().parse(path[2]) : null;
    const params = new URL(request.url).searchParams;
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(params.get("page") || 1);
    const perPage = 8;
    const conditions: SQL[] = [eq(s.appointments.patientId, user.id)];
    if (id) conditions.push(eq(s.appointments.id, id));
    const query = (params.get("q") || "").trim().slice(0, 100);
    if (query)
      conditions.push(
        ilike(
          s.appointments.trackingCode,
          `%${query.replace(/[%_\\]/g, "\\$&")}%`,
        ),
      );
    const filter = params.get("filter");
    if (filter === "pending")
      conditions.push(
        sql`${s.appointments.status} in ('awaiting_payment','awaiting_verification','awaiting_scheduling')`,
      );
    if (filter === "confirmed")
      conditions.push(eq(s.appointments.status, "confirmed"));
    if (filter === "future")
      conditions.push(
        sql`${s.appointments.status}='confirmed' and ${s.appointmentSlots.startsAt}>now()`,
      );
    if (filter === "past")
      conditions.push(
        sql`(${s.appointments.status}='completed' or ${s.appointmentSlots.endsAt}<now())`,
      );
    if (filter === "cancelled")
      conditions.push(
        sql`${s.appointments.status} in ('cancelled','expired','rejected')`,
      );
    const where = and(...conditions);
    const [count] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(s.appointments)
      .leftJoin(
        s.appointmentSlots,
        eq(s.appointmentSlots.id, s.appointments.slotId),
      )
      .where(where);
    const rows = await db
      .select({
        ...getTableColumns(s.appointments),
        startsAt: s.appointmentSlots.startsAt,
        endsAt: s.appointmentSlots.endsAt,
      })
      .from(s.appointments)
      .leftJoin(
        s.appointmentSlots,
        eq(s.appointmentSlots.id, s.appointments.slotId),
      )
      .where(where)
      .orderBy(
        params.get("sort") === "oldest"
          ? asc(s.appointments.createdAt)
          : desc(s.appointments.createdAt),
      )
      .limit(id ? 1 : perPage)
      .offset(id ? 0 : (page - 1) * perPage);
    if (id) {
      if (!rows[0]) throw new AppError(404, "NOT_FOUND");
      const history = await db
        .select({
          id: s.appointmentStatusHistory.id,
          fromState: s.appointmentStatusHistory.fromState,
          toState: s.appointmentStatusHistory.toState,
          note: s.appointmentStatusHistory.note,
          createdAt: s.appointmentStatusHistory.createdAt,
        })
        .from(s.appointmentStatusHistory)
        .where(eq(s.appointmentStatusHistory.appointmentId, id))
        .orderBy(asc(s.appointmentStatusHistory.createdAt));
      const reviews = await db
        .select({
          action: s.paymentVerificationEvents.action,
          note: s.paymentVerificationEvents.note,
          createdAt: s.paymentVerificationEvents.createdAt,
        })
        .from(s.paymentVerificationEvents)
        .where(eq(s.paymentVerificationEvents.appointmentId, id))
        .orderBy(desc(s.paymentVerificationEvents.createdAt));
      const payments = await db
        .select({
          id: s.paymentSubmissions.id,
          status: s.paymentSubmissions.status,
          transactionReference: s.paymentSubmissions.transactionReference,
          createdAt: s.paymentSubmissions.createdAt,
        })
        .from(s.paymentSubmissions)
        .where(eq(s.paymentSubmissions.appointmentId, id))
        .orderBy(desc(s.paymentSubmissions.createdAt));
      return json({
        appointment: patientAppointmentView(rows[0]),
        history,
        reviews,
        payments,
      });
    }
    return json({
      items: rows.map(patientAppointmentView),
      total: count.total,
      page,
      perPage,
    });
  }
  throw new AppError(404, "NOT_FOUND");
}
