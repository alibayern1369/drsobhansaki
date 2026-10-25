import "server-only";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { AppError } from "./security";
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
          })
          .from(s.users)
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
        await tx
          .insert(s.auditLogs)
          .values({
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
    await db
      .insert(s.auditLogs)
      .values({
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
    await db
      .insert(s.auditLogs)
      .values({
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
      await tx
        .insert(s.auditLogs)
        .values({
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
    await db
      .update(s.notifications)
      .set({ status: "pending", nextAttemptAt: new Date() })
      .where(
        and(eq(s.notifications.id, id), eq(s.notifications.status, "failed")),
      );
    await db
      .insert(s.auditLogs)
      .values({
        actorId: user.id,
        action: "sms.retry",
        entityType: "notification",
        entityId: id,
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
        cardNumber: z.string().regex(/^\d{16}$/),
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
      await tx
        .insert(s.auditLogs)
        .values({
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
        createdAt: s.paymentReceipts.createdAt,
      })
      .from(s.paymentReceipts)
      .innerJoin(
        s.paymentSubmissions,
        eq(s.paymentSubmissions.id, s.paymentReceipts.submissionId),
      )
      .where(eq(s.paymentSubmissions.appointmentId, id));
    await db
      .insert(s.auditLogs)
      .values({
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
        .select()
        .from(s.appointmentRequests)
        .where(eq(s.appointmentRequests.status, "pending"))
        .limit(100),
    );
  return null;
}
