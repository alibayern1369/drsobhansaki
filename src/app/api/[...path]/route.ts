import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, desc, eq, gt, getTableColumns } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import {
  AppError,
  checkOrigin,
  currentUser,
  hash,
  requireUser,
} from "@/server/security";
import { requestOtp, verifyOtp } from "@/server/auth";
import {
  bookAppointment,
  reviewPayment,
  assignSlot,
} from "@/server/appointments";
import { verifyMfa } from "@/server/mfa";
import { assertTransition, canVerifyPayment } from "@/lib/domain";
import { adminOperations } from "@/server/admin-operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = z.uuid();
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const messages: Record<string, [string, string]> = {
  DATABASE_NOT_CONFIGURED: [
    "اتصال پایگاه داده هنوز راه‌اندازی نشده است.",
    "Database connection is not configured yet.",
  ],
  SMS_NOT_CONFIGURED: [
    "سرویس پیامک هنوز فعال نشده است.",
    "SMS delivery is not configured yet.",
  ],
  AUTH_NOT_CONFIGURED: [
    "سامانهٔ ورود هنوز راه‌اندازی نشده است.",
    "Authentication is not configured yet.",
  ],
  SIGN_IN_REQUIRED: ["ابتدا وارد حساب خود شوید.", "Please sign in first."],
  INVALID_OTP: [
    "کد نامعتبر یا منقضی شده است.",
    "The code is invalid or expired.",
  ],
  RATE_LIMITED: [
    "درخواست‌های زیادی ارسال شده؛ کمی بعد دوباره امتحان کنید.",
    "Too many requests. Please try again later.",
  ],
  ADMIN_MFA_REQUIRED: [
    "برای دسترسی مدیر، ورود دومرحله‌ای لازم است.",
    "Administrator MFA verification is required.",
  ],
  BOOKING_NOT_OPEN: [
    "پذیرش نوبت هنوز آغاز نشده است.",
    "Bookings are not open yet.",
  ],
  SLOT_UNAVAILABLE: [
    "این زمان دیگر در دسترس نیست.",
    "This time is no longer available.",
  ],
};
async function dispatch(request: Request, segments: string[], method: string) {
  const path = segments.join("/");
  const dbConfigured = !!process.env.DATABASE_URL;
  if (method === "GET" && path === "config") {
    if (!dbConfigured)
      return response({
        ready: false,
        types: [],
        platforms: [],
        slots: [],
        banks: [],
      });
    const db = getDb();
    const [setting] = await db
      .select()
      .from(s.websiteSettings)
      .where(eq(s.websiteSettings.key, "booking"));
    return response({
      ready: !!(setting?.value as { enabled?: boolean })?.enabled,
      booking: setting?.value,
      types: await db
        .select()
        .from(s.consultationTypes)
        .where(eq(s.consultationTypes.enabled, true)),
      platforms: await db
        .select()
        .from(s.messagingPlatforms)
        .where(eq(s.messagingPlatforms.enabled, true)),
      slots: await db
        .select()
        .from(s.appointmentSlots)
        .where(
          and(
            eq(s.appointmentSlots.enabled, true),
            gt(s.appointmentSlots.startsAt, new Date()),
          ),
        )
        .orderBy(asc(s.appointmentSlots.startsAt))
        .limit(100),
      banks: await db
        .select()
        .from(s.bankAccounts)
        .where(eq(s.bankAccounts.enabled, true))
        .orderBy(asc(s.bankAccounts.sortOrder)),
    });
  }
  if (method === "GET" && path === "session") {
    const auth = await currentUser();
    return response({
      user: auth
        ? { id: auth.user.id, name: auth.user.name, role: auth.user.role }
        : null,
    });
  }
  if (!dbConfigured) throw new AppError(503, "DATABASE_NOT_CONFIGURED");
  if (method !== "GET") await checkOrigin(request);
  if (method === "POST" && path === "auth/otp") {
    const data = z.object({ phone: z.string() }).parse(await request.json());
    await requestOtp(data.phone);
    return response({ ok: true });
  }
  if (method === "POST" && path === "auth/verify") {
    const data = z
      .object({ phone: z.string(), code: z.string() })
      .parse(await request.json());
    await verifyOtp(data.phone, data.code);
    return response({ ok: true });
  }
  if (method === "POST" && path === "auth/mfa") {
    const data = z
      .object({ code: z.string().regex(/^\d{6}$/) })
      .parse(await request.json());
    await verifyMfa(data.code);
    return response({ ok: true });
  }
  if (method === "POST" && path === "auth/logout") {
    const token = (await cookies()).get("medical_session")?.value;
    if (token)
      await getDb()
        .delete(s.sessions)
        .where(eq(s.sessions.tokenHash, hash(token)));
    (await cookies()).delete("medical_session");
    return response({ ok: true });
  }
  if (method === "POST" && path === "appointments")
    return response(await bookAppointment(await request.json()), 201);
  if (method === "GET" && path === "appointments") {
    const user = await requireUser();
    return response(
      await getDb()
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
        .where(eq(s.appointments.patientId, user.id))
        .orderBy(desc(s.appointments.createdAt))
        .limit(100),
    );
  }
  if (
    method === "POST" &&
    segments[0] === "appointments" &&
    segments[2] === "request"
  ) {
    const user = await requireUser();
    const id = uuid.parse(segments[1]);
    const data = z
      .object({ kind: z.enum(["cancel", "reschedule"]) })
      .parse(await request.json());
    const [a] = await getDb()
      .select({ id: s.appointments.id })
      .from(s.appointments)
      .where(
        and(eq(s.appointments.id, id), eq(s.appointments.patientId, user.id)),
      );
    if (!a) throw new AppError(404, "NOT_FOUND");
    await getDb()
      .insert(s.appointmentRequests)
      .values({ appointmentId: id, patientId: user.id, kind: data.kind });
    return response({ ok: true });
  }
  if (segments[0] === "admin") {
    const user = await requireUser(true);
    const db = getDb();
    const operation = await adminOperations(request, segments, method, user);
    if (operation) return operation;
    if (method === "GET" && path === "admin/overview") {
      return response({
        appointments: await db
          .select()
          .from(s.appointments)
          .orderBy(desc(s.appointments.createdAt))
          .limit(100),
        consultations: await db.select().from(s.consultationTypes),
        platforms: await db.select().from(s.messagingPlatforms),
        banks: await db.select().from(s.bankAccounts),
        settings: await db.select().from(s.websiteSettings),
        content: await db.select().from(s.localizedContent),
        articles: await db.select().from(s.articles),
        audit: await db
          .select()
          .from(s.auditLogs)
          .orderBy(desc(s.auditLogs.createdAt))
          .limit(30),
      });
    }
    if (
      method === "POST" &&
      segments[1] === "appointments" &&
      segments[3] === "payment"
    ) {
      const data = z
        .object({
          action: z.enum(["approve", "reject", "request_information"]),
          bankDepositVerified: z.boolean().optional(),
          note: z.string().max(1000).optional(),
          idempotencyKey: uuid,
        })
        .parse(await request.json());
      return response(await reviewPayment(uuid.parse(segments[2]), data));
    }
    if (
      method === "POST" &&
      segments[1] === "appointments" &&
      segments[3] === "schedule"
    ) {
      const data = z.object({ slotId: uuid }).parse(await request.json());
      return response(await assignSlot(uuid.parse(segments[2]), data.slotId));
    }
    if (
      method === "POST" &&
      segments[1] === "appointments" &&
      segments[3] === "status"
    ) {
      if (!canVerifyPayment(user.role)) throw new AppError(403, "FORBIDDEN");
      const data = z
        .object({
          status: z.enum(["in_progress", "completed", "cancelled", "expired"]),
        })
        .parse(await request.json());
      const id = uuid.parse(segments[2]);
      await db.transaction(async (tx) => {
        const [a] = await tx
          .select()
          .from(s.appointments)
          .where(eq(s.appointments.id, id))
          .for("update");
        if (!a) throw new AppError(404, "NOT_FOUND");
        assertTransition("appointment", a.status, data.status);
        if (a.status === data.status) return;
        await tx
          .update(s.appointments)
          .set({ status: data.status, updatedAt: new Date() })
          .where(eq(s.appointments.id, id));
        await tx.insert(s.appointmentStatusHistory).values({
          appointmentId: id,
          actorId: user.id,
          fromState: a.status,
          toState: data.status,
        });
        await tx.insert(s.auditLogs).values({
          actorId: user.id,
          action: `appointment.${data.status}`,
          entityType: "appointment",
          entityId: id,
        });
      });
      return response({ ok: true });
    }
    if (!["doctor", "super_admin"].includes(user.role))
      throw new AppError(403, "FORBIDDEN");
    if (method === "PUT" && path === "admin/settings") {
      const data = z
        .object({
          key: z.enum(["booking", "branding", "contact", "policies", "seo"]),
          value: z.record(z.string(), z.unknown()),
        })
        .parse(await request.json());
      await db.transaction(async (tx) => {
        await tx
          .insert(s.websiteSettings)
          .values({ ...data, updatedBy: user.id })
          .onConflictDoUpdate({
            target: s.websiteSettings.key,
            set: {
              value: data.value,
              updatedBy: user.id,
              updatedAt: new Date(),
            },
          });
        await tx.insert(s.auditLogs).values({
          actorId: user.id,
          action: "settings.update",
          entityType: "settings",
          entityId: data.key,
        });
      });
      return response({ ok: true });
    }
    if (method === "PUT" && path === "admin/content") {
      const data = z
        .object({
          key: z.string().min(1).max(100),
          locale: z.enum(["fa", "en"]),
          value: z.record(z.string(), z.string().max(10000)),
          published: z.boolean(),
        })
        .parse(await request.json());
      await db.transaction(async (tx) => {
        await tx
          .insert(s.localizedContent)
          .values({ ...data, updatedBy: user.id })
          .onConflictDoUpdate({
            target: [s.localizedContent.key, s.localizedContent.locale],
            set: {
              value: data.value,
              published: data.published,
              updatedBy: user.id,
              updatedAt: new Date(),
            },
          });
        await tx.insert(s.auditLogs).values({
          actorId: user.id,
          action: "content.update",
          entityType: "content",
          entityId: data.key,
        });
      });
      return response({ ok: true });
    }
    if (method === "PUT" && segments[1] === "consultations") {
      const data = z
        .object({
          priceRial: z.number().int().nonnegative().max(2000000000),
          durationMinutes: z.number().int().min(5).max(180),
          enabled: z.boolean(),
          bufferMinutes: z.number().int().min(0).max(120),
        })
        .parse(await request.json());
      await db.transaction(async (tx) => {
        await tx
          .update(s.consultationTypes)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(s.consultationTypes.id, uuid.parse(segments[2])));
        await tx.insert(s.auditLogs).values({
          actorId: user.id,
          action: "consultation.update",
          entityType: "consultation",
          entityId: segments[2],
        });
      });
      return response({ ok: true });
    }
    if (method === "PUT" && segments[1] === "platforms") {
      const data = z
        .object({
          enabled: z.boolean(),
          contactNumber: z.string().max(30).nullable(),
          username: z.string().max(100).nullable(),
          link: z
            .url()
            .refine((v) => v.startsWith("https://"))
            .nullable(),
        })
        .parse(await request.json());
      await db
        .update(s.messagingPlatforms)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(s.messagingPlatforms.id, uuid.parse(segments[2])));
      await db.insert(s.auditLogs).values({
        actorId: user.id,
        action: "platform.update",
        entityType: "platform",
        entityId: segments[2],
      });
      return response({ ok: true });
    }
    if (method === "POST" && path === "admin/slots") {
      const data = z
        .object({
          consultationTypeId: uuid,
          startsAt: z.iso.datetime(),
          endsAt: z.iso.datetime(),
        })
        .refine(
          (v) =>
            new Date(v.startsAt) > new Date() &&
            new Date(v.endsAt) > new Date(v.startsAt),
        )
        .parse(await request.json());
      const [slot] = await db
        .insert(s.appointmentSlots)
        .values({
          ...data,
          startsAt: new Date(data.startsAt),
          endsAt: new Date(data.endsAt),
        })
        .returning();
      return response(slot, 201);
    }
    if (method === "POST" && path === "admin/banks") {
      const data = z
        .object({
          bankName: z.string().min(2).max(100),
          holderName: z.string().min(3).max(100),
          cardNumber: z.string().regex(/^\d{16}$/),
          enabled: z.boolean(),
          sortOrder: z.number().int(),
        })
        .parse(await request.json());
      const [bank] = await db.insert(s.bankAccounts).values(data).returning();
      await db.insert(s.auditLogs).values({
        actorId: user.id,
        action: "bank.create",
        entityType: "bank",
        entityId: bank.id,
      });
      return response(bank, 201);
    }
    if (method === "POST" && path === "admin/articles") {
      const data = z
        .object({
          slug: z.string().regex(/^[a-z0-9-]+$/),
          locale: z.enum(["fa", "en"]),
          title: z.string().min(3).max(200),
          body: z.string().min(20).max(100000),
          description: z.string().max(300),
        })
        .parse(await request.json());
      return response(
        await db.transaction(async (tx) => {
          const [a] = await tx
            .insert(s.articles)
            .values({ slug: data.slug, status: "draft", authorId: user.id })
            .onConflictDoUpdate({
              target: s.articles.slug,
              set: {
                status: "draft",
                reviewerId: null,
                reviewedAt: null,
                updatedAt: new Date(),
              },
            })
            .returning();
          const [old] = await tx
            .select()
            .from(s.articleTranslations)
            .where(
              and(
                eq(s.articleTranslations.articleId, a.id),
                eq(s.articleTranslations.locale, data.locale),
              ),
            );
          if (old)
            await tx.insert(s.articleRevisions).values({
              translationId: old.id,
              editorId: user.id,
              snapshot: old,
            });
          await tx
            .insert(s.articleTranslations)
            .values({
              articleId: a.id,
              locale: data.locale,
              title: data.title,
              body: data.body,
              description: data.description,
            })
            .onConflictDoUpdate({
              target: [
                s.articleTranslations.articleId,
                s.articleTranslations.locale,
              ],
              set: {
                title: data.title,
                body: data.body,
                description: data.description,
                approvedAt: null,
                approvedBy: null,
                updatedAt: new Date(),
              },
            });
          await tx.insert(s.auditLogs).values({
            actorId: user.id,
            action: "article.save_draft",
            entityType: "article",
            entityId: a.id,
          });
          return a;
        }),
        201,
      );
    }
    if (
      method === "POST" &&
      segments[1] === "articles" &&
      segments[3] === "approve"
    ) {
      const id = uuid.parse(segments[2]);
      const data = z
        .object({ locale: z.enum(["fa", "en"]) })
        .parse(await request.json());
      await db.transaction(async (tx) => {
        const result = await tx
          .update(s.articleTranslations)
          .set({ approvedAt: new Date(), approvedBy: user.id })
          .where(
            and(
              eq(s.articleTranslations.articleId, id),
              eq(s.articleTranslations.locale, data.locale),
            ),
          )
          .returning({ id: s.articleTranslations.id });
        if (!result.length) throw new AppError(404, "NOT_FOUND");
        await tx
          .update(s.articles)
          .set({
            status: "published",
            reviewerId: user.id,
            reviewedAt: new Date(),
            publishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(s.articles.id, id));
        await tx.insert(s.auditLogs).values({
          actorId: user.id,
          action: "article.approve",
          entityType: "article",
          entityId: id,
        });
      });
      return response({ ok: true });
    }
  }
  throw new AppError(404, "NOT_FOUND");
}
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
  method: string,
) {
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 6 * 1024 * 1024) throw new AppError(413, "INVALID_FILE_SIZE");
    const { path } = await context.params;
    return await dispatch(request, path, method);
  } catch (e) {
    const fa =
      request.headers.get("accept-language")?.startsWith("en") !== true;
    const code =
      e instanceof AppError
        ? e.code
        : e instanceof z.ZodError
          ? "INVALID_INPUT"
          : e instanceof Error && e.message === "DATABASE_NOT_CONFIGURED"
            ? "DATABASE_NOT_CONFIGURED"
            : "REQUEST_FAILED";
    const status =
      e instanceof AppError
        ? e.status
        : e instanceof z.ZodError
          ? 400
          : code === "DATABASE_NOT_CONFIGURED"
            ? 503
            : 500;
    return response(
      {
        code,
        message:
          messages[code]?.[fa ? 0 : 1] ||
          (fa
            ? "درخواست انجام نشد. اطلاعات را بررسی کنید و دوباره تلاش کنید."
            : "Request failed. Please check the details and try again."),
      },
      status,
    );
  }
}
export const GET = (r: Request, c: { params: Promise<{ path: string[] }> }) =>
  handle(r, c, "GET");
export const POST = (r: Request, c: { params: Promise<{ path: string[] }> }) =>
  handle(r, c, "POST");
export const PUT = (r: Request, c: { params: Promise<{ path: string[] }> }) =>
  handle(r, c, "PUT");
