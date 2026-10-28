import { patientOperation } from "@/server/patient-portal";
import { availableSlots, expireBookingHolds } from "@/server/availability";
import { after } from "next/server";
import { runJobs } from "@/server/jobs";
import { messengerLink, patientAppointmentView } from "@/lib/booking-flow";
import { consultationContactAllowed } from "@/lib/patient-portal";
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, desc, eq, inArray, getTableColumns, sql } from "drizzle-orm";
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
import { validateSiteSettings } from "@/lib/site-settings";
import { normalizeDigits } from "@/lib/admin-labels";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = z.uuid();
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const messages: Record<string, [string, string]> = {
  INVALID_TRANSITION: [
    "وضعیت فعلی نوبت یا پرداخت اجازه این تغییر را نمی‌دهد؛ اطلاعات را دوباره دریافت کنید.",
    "This change is not allowed in the current state. Refresh the details.",
  ],
  INVALID_INPUT: [
    "اطلاعات واردشده معتبر نیست؛ فیلدها را بررسی کنید.",
    "Please check the entered information.",
  ],
  NOT_FOUND: [
    "اطلاعات موردنظر پیدا نشد.",
    "The requested information was not found.",
  ],
  CONSULTATION_UNAVAILABLE: [
    "این روش مشاوره در حال حاضر فعال نیست.",
    "This consultation is currently unavailable.",
  ],
  PLATFORM_UNAVAILABLE: [
    "پیام‌رسان انتخابی فعال یا تنظیم نشده است.",
    "The selected messenger is unavailable or unconfigured.",
  ],
  PLATFORM_REQUIRED: [
    "پیام‌رسان مشاوره را انتخاب کنید.",
    "Choose a consultation messenger.",
  ],
  BANK_VERIFICATION_REQUIRED: [
    "ابتدا واریز را در حساب بانکی بررسی و تطبیق دهید.",
    "Verify and match the bank deposit before approving it.",
  ],
  IDEMPOTENCY_CONFLICT: [
    "این درخواست قبلاً با اطلاعات دیگری ثبت شده است؛ صفحه را دوباره دریافت کنید.",
    "This request was already submitted with different details. Refresh the page.",
  ],
  REVIEW_REASON_REQUIRED: [
    "دلیل رد یا درخواست اصلاح رسید را وارد کنید.",
    "Enter a rejection or correction reason.",
  ],
  PRICE_CHANGED: [
    "تعرفه تغییر کرده است؛ صفحه را دوباره بارگذاری و مبلغ جدید را بررسی کنید.",
    "The price changed. Reload and review the new amount.",
  ],
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
  PLATFORM_CONTACT_REQUIRED: [
    "برای فعال‌کردن پیام‌رسان، شماره، شناسه یا لینک معتبر وارد کنید.",
    "Enter a valid messenger number, username or link before enabling it.",
  ],
  PAYMENT_NOT_APPROVED: [
    "ابتدا پرداخت باید تأیید شود.",
    "Payment approval is required.",
  ],
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
    await expireBookingHolds();
    const booking = setting?.value as { enabled?: boolean } | undefined;
    return response({
      ready: !!booking?.enabled,
      booking,
      types: await db
        .select()
        .from(s.consultationTypes)
        .where(
          and(
            inArray(s.consultationTypes.key, ["phone", "text"]),
            eq(s.consultationTypes.enabled, true),
          ),
        ),
      platforms: (
        await db
          .select()
          .from(s.messagingPlatforms)
          .where(eq(s.messagingPlatforms.enabled, true))
      )
        .filter((p) => messengerLink(p))
        .map((p) => ({ id: p.id, key: p.key })),
      slots: await availableSlots(),
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
        ? {
            id: auth.user.id,
            name: auth.user.name,
            role: auth.user.role,
            phone: auth.user.phone,
          }
        : null,
    });
  }
  if (!dbConfigured) throw new AppError(503, "DATABASE_NOT_CONFIGURED");
  if (method !== "GET") await checkOrigin(request);
  if (
    path === "auth/test-patient" ||
    segments[0] === "test-patient" ||
    path === "admin/test-patient"
  )
    throw new AppError(404, "NOT_FOUND");
  const patientResponse = await patientOperation(request, segments, method);
  if (patientResponse) return patientResponse;
  if (method === "POST" && path === "auth/otp") {
    const data = z
      .object({ phone: z.string().transform(normalizeDigits) })
      .parse(await request.json());
    if (data.phone === "09000000000") throw new AppError(400, "INVALID_INPUT");
    await requestOtp(data.phone);
    return response({ ok: true });
  }
  if (method === "POST" && path === "auth/verify") {
    const data = z
      .object({
        phone: z.string().transform(normalizeDigits),
        code: z.string().transform(normalizeDigits),
      })
      .parse(await request.json());
    const user = await verifyOtp(data.phone, data.code);
    return response({ ok: true, profileRequired: !user.name?.trim() });
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
  if (method === "POST" && path === "appointments") {
    await expireBookingHolds();
    return response(
      patientAppointmentView(await bookAppointment(await request.json())),
      201,
    );
  }
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
        .limit(100)
        .then((rows) => rows.map(patientAppointmentView)),
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
  if (
    method === "GET" &&
    segments[0] === "appointments" &&
    segments[2] === "contact"
  ) {
    const user = await requireUser();
    const id = uuid.parse(segments[1]);
    const [item] = await getDb()
      .select()
      .from(s.appointments)
      .where(
        and(eq(s.appointments.id, id), eq(s.appointments.patientId, user.id)),
      );
    if (!item) throw new AppError(404, "NOT_FOUND");
    if (!consultationContactAllowed(item))
      throw new AppError(403, "PAYMENT_NOT_APPROVED");
    const platform = (item.platformSnapshot || {}) as { key?: string };
    const options = await getDb()
      .select()
      .from(s.messagingPlatforms)
      .where(eq(s.messagingPlatforms.enabled, true));
    return response({
      instructions:
        options.find((p) => p.key === platform.key)?.instructions || null,
      channels: options
        .filter(
          (p) =>
            ["telegram", "whatsapp", "bale"].includes(p.key) &&
            messengerLink(p),
        )
        .sort(
          (a, b) =>
            Number(b.key === platform.key) - Number(a.key === platform.key),
        )
        .map((p) => ({
          key: p.key,
          url: messengerLink(p),
          contactNumber: p.contactNumber,
          username: p.username,
        })),
    });
  }
  if (segments[0] === "admin") {
    const user = await requireUser(true);
    const db = getDb();
    const operation = await adminOperations(request, segments, method, user);
    if (operation) return operation;
    if (method === "GET" && path === "admin/overview") {
      return response({
        role: user.role,
        currentUserId: user.id,
        stats: (
          await db
            .select({
              total: sql<number>`count(*)::int`,
              review: sql<number>`count(*) filter (where payment_status='under_review')::int`,
              confirmed: sql<number>`count(*) filter (where status='confirmed')::int`,
              completed: sql<number>`count(*) filter (where status='completed')::int`,
            })
            .from(s.appointments)
        )[0],
        appointments: await db
          .select({
            ...getTableColumns(s.appointments),
            patientName: s.users.name,
            patientPhone: s.users.phone,
          })
          .from(s.appointments)
          .innerJoin(s.users, eq(s.users.id, s.appointments.patientId))
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
      const result = await reviewPayment(uuid.parse(segments[2]), data);
      after(async () => {
        await runJobs(uuid.parse(segments[2])).catch(() => undefined);
      });
      return response(result);
    }
    if (
      method === "POST" &&
      segments[1] === "appointments" &&
      segments[3] === "schedule"
    ) {
      const data = z.object({ slotId: uuid }).parse(await request.json());
      const result = await assignSlot(uuid.parse(segments[2]), data.slotId);
      after(async () => {
        await runJobs(uuid.parse(segments[2])).catch(() => undefined);
      });
      return response(result);
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
          key: z.enum([
            "booking",
            "branding",
            "contact",
            "policies",
            "seo",
            "social",
            "consultationContact",
          ]),
          value: z.record(z.string(), z.unknown()),
        })
        .parse(await request.json());
      data.value = validateSiteSettings(data.key, data.value);
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
        const updated = await tx
          .update(s.consultationTypes)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(s.consultationTypes.id, uuid.parse(segments[2])))
          .returning({ id: s.consultationTypes.id });
        if (!updated.length) throw new AppError(404, "NOT_FOUND");
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
      const [existingPlatform] = await db
        .select()
        .from(s.messagingPlatforms)
        .where(eq(s.messagingPlatforms.id, uuid.parse(segments[2])));
      if (!existingPlatform) throw new AppError(404, "NOT_FOUND");
      if (data.enabled && !messengerLink({ ...existingPlatform, ...data }))
        throw new AppError(400, "PLATFORM_CONTACT_REQUIRED");
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
          cardNumber: z
            .string()
            .transform((v) => normalizeDigits(v).replace(/[\s-]/g, ""))
            .pipe(z.string().regex(/^\d{16}$/)),
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
          status: z.enum(["draft", "published"]).default("published"),
          references: z
            .array(
              z.object({
                title: z.string().min(1).max(300),
                url: z.url().refine((v) => v.startsWith("https://")),
              }),
            )
            .max(20)
            .optional(),
        })
        .parse(await request.json());
      return response(
        await db.transaction(async (tx) => {
          const [a] = await tx
            .insert(s.articles)
            .values({
              slug: data.slug,
              status: data.status,
              publishedAt: data.status === "published" ? new Date() : null,
              authorId: user.id,
            })
            .onConflictDoUpdate({
              target: s.articles.slug,
              set: {
                status: data.status,
                publishedAt:
                  data.status === "published"
                    ? sql`coalesce(${s.articles.publishedAt}, now())`
                    : null,
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
            action:
              data.status === "published"
                ? "article.publish"
                : "article.save_draft",
            entityType: "article",
            entityId: a.id,
          });
          if (data.references) {
            await tx
              .delete(s.medicalReferences)
              .where(eq(s.medicalReferences.articleId, a.id));
            if (data.references.length)
              await tx.insert(s.medicalReferences).values(
                data.references.map((ref) => ({
                  articleId: a.id,
                  title: ref.title,
                  url: ref.url,
                  checkedAt: new Date(),
                })),
              );
          }
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
    const invalidTransition =
      e instanceof Error && e.message === "INVALID_TRANSITION";
    const code =
      e instanceof AppError
        ? e.code
        : invalidTransition
          ? "INVALID_TRANSITION"
          : e instanceof z.ZodError
            ? "INVALID_INPUT"
            : e instanceof Error && e.message === "DATABASE_NOT_CONFIGURED"
              ? "DATABASE_NOT_CONFIGURED"
              : "REQUEST_FAILED";
    const status =
      e instanceof AppError
        ? e.status
        : invalidTransition
          ? 409
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
