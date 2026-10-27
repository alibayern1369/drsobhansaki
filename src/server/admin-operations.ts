import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  ne,
  gt,
  sql,
  getTableColumns,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { AppError } from "./security";
import { normalizeDigits } from "@/lib/admin-labels";
import { after } from "next/server";
import { runJobs } from "./jobs";
const uuid = z.uuid();
type User = { id: string; role: string };
export async function adminOperations(
  request: Request,
  path: string[],
  method: string,
  user: User,
): Promise<Response | null> {
  const db = getDb();
  const key = path[1];
  const json = (v: unknown, status = 200) =>
    Response.json(v, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  const privileged = () => {
    if (!["doctor", "super_admin"].includes(user.role))
      throw new AppError(403, "FORBIDDEN");
  };
  if (key === "appointment-list" && method === "GET") {
    const params = new URL(request.url).searchParams;
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(params.get("page") || 1);
    const search = normalizeDigits(params.get("q") || "")
      .trim()
      .slice(0, 100);
    const conditions: SQL[] = [];
    if (search)
      conditions.push(
        sql`concat(${s.users.name}, ' ', ${s.users.phone}, ' ', ${s.appointments.trackingCode}) ilike ${"%" + search.replace(/[%_\\]/g, "\\$&") + "%"}`,
      );
    const status = params.get("status");
    if (status)
      conditions.push(sql`${s.appointments.status}::text = ${status}`);
    for (const [key, op] of [
      ["from", ">="],
      ["to", "<="],
    ] as const) {
      const value = params.get(key);
      if (value) {
        const date = z.iso.date().parse(value);
        conditions.push(
          op === ">="
            ? sql`${s.appointmentSlots.startsAt} >= ${date + "T00:00:00+03:30"}::timestamptz`
            : sql`${s.appointmentSlots.startsAt} < ${date + "T00:00:00+03:30"}::timestamptz + interval '1 day'`,
        );
      }
    }
    const where = and(...conditions);
    const [count] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(s.appointments)
      .innerJoin(s.users, eq(s.users.id, s.appointments.patientId))
      .leftJoin(
        s.appointmentSlots,
        eq(s.appointmentSlots.id, s.appointments.slotId),
      )
      .where(where);
    const items = await db
      .select({
        ...getTableColumns(s.appointments),
        patientName: s.users.name,
        patientPhone: s.users.phone,
        startsAt: s.appointmentSlots.startsAt,
      })
      .from(s.appointments)
      .innerJoin(s.users, eq(s.users.id, s.appointments.patientId))
      .leftJoin(
        s.appointmentSlots,
        eq(s.appointmentSlots.id, s.appointments.slotId),
      )
      .where(where)
      .orderBy(desc(s.appointments.createdAt))
      .limit(15)
      .offset((page - 1) * 15);
    return json({
      items: items.map((a) => ({ ...a, platformSnapshot: null })),
      total: count.total,
      page,
    });
  }
  if (key === "appointment-history" && method === "GET" && path[2]) {
    privileged();
    return json(
      await db
        .select({
          id: s.appointmentStatusHistory.id,
          fromState: s.appointmentStatusHistory.fromState,
          toState: s.appointmentStatusHistory.toState,
          note: s.appointmentStatusHistory.note,
          createdAt: s.appointmentStatusHistory.createdAt,
          actorName: s.users.name,
          actorRole: s.users.role,
        })
        .from(s.appointmentStatusHistory)
        .innerJoin(s.users, eq(s.users.id, s.appointmentStatusHistory.actorId))
        .where(
          eq(s.appointmentStatusHistory.appointmentId, uuid.parse(path[2])),
        )
        .orderBy(asc(s.appointmentStatusHistory.createdAt)),
    );
  }
  if (method === "GET" && key === "patients") {
    return json(
      await db
        .select({
          id: s.users.id,
          name: s.users.name,
          phone: s.users.phone,
          createdAt: s.users.createdAt,
          disabled: s.users.disabled,
        })
        .from(s.users)
        .where(eq(s.users.role, "patient"))
        .orderBy(desc(s.users.createdAt))
        .limit(200),
    );
  }
  if (key === "roles") {
    if (user.role !== "super_admin") throw new AppError(403, "FORBIDDEN");
    if (method === "GET")
      return json(
        await db
          .select({
            id: s.users.id,
            name: s.users.name,
            phone: s.users.phone,
            role: s.users.role,
            disabled: s.users.disabled,
            username: s.adminCredentials.username,
          })
          .from(s.users)
          .leftJoin(
            s.adminCredentials,
            eq(s.adminCredentials.userId, s.users.id),
          )
          .where(ne(s.users.role, "patient"))
          .limit(200),
      );
    if (method === "PUT" && path[2]) {
      const id = uuid.parse(path[2]);
      const data = z
        .object({
          role: z.enum(["patient", "staff", "doctor", "super_admin"]),
          disabled: z.boolean(),
        })
        .parse(await request.json());
      if (id === user.id) throw new AppError(400, "SELF_ROLE_CHANGE_FORBIDDEN");
      await db.transaction(async (tx) => {
        await tx
          .update(s.users)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(s.users.id, id));
        await tx.delete(s.sessions).where(eq(s.sessions.userId, id));
        await tx.insert(s.auditLogs).values({
          actorId: user.id,
          action: "user.role_update",
          entityType: "user",
          entityId: id,
          metadata: { role: data.role, disabled: data.disabled },
        });
      });
      return json({ ok: true });
    }
  }
  if (method === "GET" && key === "calendar")
    return json({
      slots: await db
        .select()
        .from(s.appointmentSlots)
        .where(gt(s.appointmentSlots.endsAt, new Date()))
        .orderBy(asc(s.appointmentSlots.startsAt))
        .limit(200),
      availability: await db.select().from(s.doctorAvailability),
      blocked: await db.select().from(s.blockedDates),
      types: await db.select().from(s.consultationTypes),
    });
  if (key === "blocked-dates" && method === "PUT" && path[2]) {
    privileged();
    const id = uuid.parse(path[2]);
    z.object({ remove: z.literal(true) }).parse(await request.json());
    await db.transaction(async (tx) => {
      await tx.delete(s.blockedDates).where(eq(s.blockedDates.id, id));
      await tx.insert(s.auditLogs).values({
        actorId: user.id,
        action: "calendar.unblock",
        entityType: "blocked_date",
        entityId: id,
      });
    });
    return json({ ok: true });
  }
  if (key === "slot-batch" && method === "POST") {
    privileged();
    const input = z
      .object({
        consultationTypeId: uuid,
        date: z.iso.date(),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      })
      .refine((v) => v.endTime > v.startTime)
      .parse(await request.json());
    const [type] = await db
      .select()
      .from(s.consultationTypes)
      .where(eq(s.consultationTypes.id, input.consultationTypeId));
    if (!type) throw new AppError(404, "NOT_FOUND");
    const start = new Date(`${input.date}T${input.startTime}:00+03:30`);
    const end = new Date(`${input.date}T${input.endTime}:00+03:30`);
    if (start <= new Date()) throw new AppError(400, "INVALID_INPUT");
    const slots: Array<{
      consultationTypeId: string;
      startsAt: Date;
      endsAt: Date;
    }> = [];
    for (
      let time = start.getTime();
      time + type.durationMinutes * 60000 <= end.getTime();
      time += (type.durationMinutes + type.bufferMinutes) * 60000
    )
      slots.push({
        consultationTypeId: type.id,
        startsAt: new Date(time),
        endsAt: new Date(time + type.durationMinutes * 60000),
      });
    if (!slots.length || slots.length > 288)
      throw new AppError(400, "INVALID_INPUT");
    const count = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('doctor-schedule'))`,
      );
      const added = await tx
        .insert(s.appointmentSlots)
        .values(slots)
        .onConflictDoNothing()
        .returning({ id: s.appointmentSlots.id });
      await tx.insert(s.auditLogs).values({
        actorId: user.id,
        action: "calendar.generate",
        entityType: "calendar",
        metadata: { count: added.length, date: input.date },
      });
      return added.length;
    });
    return json({ ok: true, count }, 201);
  }
  if (key === "availability" && method === "POST") {
    privileged();
    const data = z
      .object({
        consultationTypeId: uuid,
        weekday: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        capacity: z.literal(1),
      })
      .refine((x) => x.endTime > x.startTime)
      .parse(await request.json());
    const [row] = await db
      .insert(s.doctorAvailability)
      .values({ ...data, timezone: "Asia/Tehran" })
      .returning();
    return json(row, 201);
  }
  if (key === "blocked-dates" && method === "POST") {
    privileged();
    const data = z
      .object({
        startsAt: z.iso.datetime(),
        endsAt: z.iso.datetime(),
        reason: z.string().max(200).optional(),
      })
      .refine((x) => x.endsAt > x.startsAt)
      .parse(await request.json());
    const [row] = await db
      .insert(s.blockedDates)
      .values({
        ...data,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
      })
      .returning();
    await db.insert(s.auditLogs).values({
      actorId: user.id,
      action: "calendar.block",
      entityType: "blocked_date",
      entityId: row.id,
    });
    return json(row, 201);
  }
  if (key === "slots" && method === "PUT" && path[2]) {
    privileged();
    const data = z.object({ enabled: z.boolean() }).parse(await request.json());
    const id = uuid.parse(path[2]);
    await db
      .update(s.appointmentSlots)
      .set(data)
      .where(eq(s.appointmentSlots.id, id));
    await db.insert(s.auditLogs).values({
      actorId: user.id,
      action: "slot.update",
      entityType: "slot",
      entityId: id,
    });
    return json({ ok: true });
  }
  if (key === "sms" && method === "GET") {
    privileged();
    return json({
      templates: await db.select().from(s.smsTemplates),
      deliveries: await db
        .select({
          id: s.notifications.id,
          event: s.notifications.event,
          status: s.notifications.status,
          attempts: s.notifications.attempts,
          lastError: s.notifications.lastError,
          nextAttemptAt: s.notifications.nextAttemptAt,
          providerId: s.notifications.providerId,
          createdAt: s.notifications.createdAt,
        })
        .from(s.notifications)
        .orderBy(desc(s.notifications.createdAt))
        .limit(100),
    });
  }
  if (key === "sms" && method === "PUT") {
    privileged();
    const data = z
      .object({
        key: z
          .string()
          .regex(/^[a-z_]+$/)
          .max(100),
        content: z.object({
          fa: z.string().min(1).max(500),
          en: z.string().min(1).max(500),
        }),
        enabled: z.boolean(),
      })
      .parse(await request.json());
    await db.transaction(async (tx) => {
      await tx
        .insert(s.smsTemplates)
        .values(data)
        .onConflictDoUpdate({
          target: s.smsTemplates.key,
          set: {
            content: data.content,
            enabled: data.enabled,
            updatedAt: new Date(),
          },
        });
      await tx.insert(s.auditLogs).values({
        actorId: user.id,
        action: "sms.template_update",
        entityType: "sms_template",
        entityId: data.key,
      });
    });
    return json({ ok: true });
  }
  if (key === "sms-retry" && method === "POST" && path[2]) {
    privileged();
    const id = uuid.parse(path[2]);
    const changed = await db
      .update(s.notifications)
      .set({ status: "pending", nextAttemptAt: new Date() })
      .where(
        and(eq(s.notifications.id, id), eq(s.notifications.status, "failed")),
      )
      .returning({ id: s.notifications.id });
    if (!changed.length) throw new AppError(409, "INVALID_TRANSITION");
    await db.insert(s.auditLogs).values({
      actorId: user.id,
      action: "sms.retry",
      entityType: "notification",
      entityId: id,
    });
    after(async () => {
      await runJobs(undefined, id).catch(() => undefined);
    });
    return json({ ok: true });
  }
  if (key === "banks" && method === "GET") {
    privileged();
    return json(
      await db
        .select()
        .from(s.bankAccounts)
        .orderBy(asc(s.bankAccounts.sortOrder)),
    );
  }
  if (key === "banks" && method === "PUT" && path[2]) {
    privileged();
    const data = z
      .object({
        bankName: z.string().min(2).max(100),
        holderName: z.string().min(3).max(100),
        cardNumber: z
          .string()
          .transform((v) => normalizeDigits(v).replace(/[\s-]/g, ""))
          .pipe(z.string().regex(/^\d{16}$/)),
        enabled: z.boolean(),
        sortOrder: z.number().int().min(0).max(100),
      })
      .parse(await request.json());
    const id = uuid.parse(path[2]);
    await db.transaction(async (tx) => {
      await tx
        .update(s.bankAccounts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(s.bankAccounts.id, id));
      await tx.insert(s.auditLogs).values({
        actorId: user.id,
        action: "bank.update",
        entityType: "bank",
        entityId: id,
      });
    });
    return json({ ok: true });
  }
  if (key === "article-list" && method === "GET") {
    privileged();
    return json(
      await db
        .select({
          id: s.articles.id,
          slug: s.articles.slug,
          status: s.articles.status,
          locale: s.articleTranslations.locale,
          title: s.articleTranslations.title,
          body: s.articleTranslations.body,
          description: s.articleTranslations.description,
          approvedAt: s.articleTranslations.approvedAt,
        })
        .from(s.articles)
        .innerJoin(
          s.articleTranslations,
          eq(s.articleTranslations.articleId, s.articles.id),
        )
        .orderBy(desc(s.articles.updatedAt))
        .limit(100),
    );
  }
  if (key === "payment-details" && method === "GET" && path[2]) {
    privileged();
    const id = uuid.parse(path[2]);
    const rows = await db
      .select({
        id: s.paymentReceipts.id,
        mimeType: s.paymentReceipts.mimeType,
        scanStatus: s.paymentReceipts.scanStatus,
        verificationStatus: s.paymentReceipts.verificationStatus,
        deletionStatus: s.paymentReceipts.deletionStatus,
        retentionHold: s.paymentReceipts.retentionHold,
        legalRetentionHold: s.paymentReceipts.legalRetentionHold,
        disputeActive: s.paymentSubmissions.disputeActive,
        legalRetentionUntil: s.paymentSubmissions.legalRetentionUntil,
        createdAt: s.paymentReceipts.createdAt,
        uploadedAt: s.paymentReceipts.uploadedAt,
        transactionReference: s.paymentSubmissions.transactionReference,
      })
      .from(s.paymentReceipts)
      .innerJoin(
        s.paymentSubmissions,
        eq(s.paymentSubmissions.id, s.paymentReceipts.paymentId),
      )
      .where(eq(s.paymentSubmissions.appointmentId, id));
    await db.insert(s.auditLogs).values({
      actorId: user.id,
      action: "payment.details_access",
      entityType: "appointment",
      entityId: id,
    });
    return json(rows);
  }
  if (key === "appointment-requests" && method === "GET")
    return json(
      await db
        .select({
          id: s.appointmentRequests.id,
          appointmentId: s.appointmentRequests.appointmentId,
          kind: s.appointmentRequests.kind,
          status: s.appointmentRequests.status,
          createdAt: s.appointmentRequests.createdAt,
          trackingCode: s.appointments.trackingCode,
          name: s.users.name,
          phone: s.users.phone,
        })
        .from(s.appointmentRequests)
        .innerJoin(
          s.appointments,
          eq(s.appointments.id, s.appointmentRequests.appointmentId),
        )
        .innerJoin(s.users, eq(s.users.id, s.appointmentRequests.patientId))
        .where(eq(s.appointmentRequests.status, "pending"))
        .limit(100),
    );
  if (key === "appointment-requests" && method === "PUT" && path[2]) {
    privileged();
    const id = uuid.parse(path[2]);
    const data = z
      .object({ status: z.enum(["resolved", "rejected"]) })
      .parse(await request.json());
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(s.appointmentRequests)
        .set(data)
        .where(
          and(
            eq(s.appointmentRequests.id, id),
            eq(s.appointmentRequests.status, "pending"),
          ),
        )
        .returning();
      if (!row) throw new AppError(404, "NOT_FOUND");
      await tx.insert(s.auditLogs).values({
        actorId: user.id,
        action: "appointment.request_review",
        entityType: "appointment",
        entityId: row.appointmentId,
        metadata: { requestId: id, status: data.status },
      });
    });
    return json({ ok: true });
  }
  if (key === "articles" && method === "PUT" && path[2]) {
    privileged();
    const id = uuid.parse(path[2]);
    const input = z
      .object({ status: z.enum(["draft", "published", "archived"]) })
      .parse(await request.json());
    await db.transaction(async (tx) => {
      await tx
        .update(s.articles)
        .set({
          status: input.status,
          ...(input.status === "published" ? { publishedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(s.articles.id, id));
      await tx.insert(s.auditLogs).values({
        actorId: user.id,
        action: `article.${input.status}`,
        entityType: "article",
        entityId: id,
      });
    });
    return json({ ok: true });
  }
  return null;
}
