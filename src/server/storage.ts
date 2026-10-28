import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  appointments,
  appointmentStatusHistory,
  auditLogs,
  bankAccounts,
  notifications,
  paymentReceipts,
  paymentSubmissions,
  websiteSettings,
} from "@/db/schema";
import { inspectPrivateReceipt } from "@/lib/receipt-content";
import {
  receiptUploadGrant,
  receiptReviewTransition,
} from "@/lib/receipt-upload";
import {
  MAX_RECEIPT_BYTES,
  parseReceiptPolicy,
  RECEIPT_MIME_TYPES,
  receiptAccessAllowed,
  sanitizeReceiptFilename,
} from "@/lib/receipt-policy";
import { AppError, currentUser, rateLimit, requireUser } from "./security";
import { blobToken, privateReceiptStorage } from "./blob-store";
const prepareSchema = z.object({
  transactionReference: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[\p{L}\p{N}\s_\-/]+$/u)
    .optional(),
  bankAccountId: z.uuid(),
  originalFilename: z.string().min(1).max(255),
  mimeType: z.enum(RECEIPT_MIME_TYPES),
  fileSize: z.number().int().min(1).max(MAX_RECEIPT_BYTES),
  idempotencyKey: z.uuid(),
});
const uploadable = [
  "awaiting_payment",
  "rejected",
  "additional_information_required",
];
export async function prepareReceipt(appointmentId: string, input: unknown) {
  const user = await requireUser();
  const data = prepareSchema.parse(input);
  blobToken();
  await rateLimit(`receipt-upload:${user.id}`, 10, 900);
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock_shared(hashtext('receipt-cleanup'))`,
    );
    const [a] = await tx
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.patientId, user.id),
        ),
      )
      .for("update");
    if (!a) throw new AppError(404, "NOT_FOUND");
    if (a.status === "awaiting_payment" && a.expiresAt <= new Date())
      throw new AppError(409, "UPLOAD_EXPIRED");
    const [existing] = await tx
      .select()
      .from(paymentReceipts)
      .innerJoin(
        paymentSubmissions,
        eq(paymentSubmissions.id, paymentReceipts.paymentId),
      )
      .where(eq(paymentReceipts.uploadIdempotencyKey, data.idempotencyKey));
    if (existing) {
      const r = existing.payment_receipts;
      if (
        r.patientId !== user.id ||
        existing.payment_submissions.appointmentId !== a.id
      )
        throw new AppError(409, "IDEMPOTENCY_CONFLICT");
      return {
        receiptId: r.id,
        pathname: r.blobPathname,
        verificationStatus: r.verificationStatus,
      };
    }
    if (
      !uploadable.includes(a.paymentStatus) ||
      ["cancelled", "expired", "rejected", "completed"].includes(a.status)
    )
      throw new AppError(409, "INVALID_TRANSITION");
    const [bank] = await tx
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(
        and(
          eq(bankAccounts.id, data.bankAccountId),
          eq(bankAccounts.enabled, true),
          isNull(bankAccounts.deletedAt),
        ),
      );
    if (!bank) throw new AppError(400, "BANK_ACCOUNT_UNAVAILABLE");
    const active = await tx
      .select({ id: paymentReceipts.id })
      .from(paymentReceipts)
      .innerJoin(
        paymentSubmissions,
        eq(paymentSubmissions.id, paymentReceipts.paymentId),
      )
      .where(
        and(
          eq(paymentSubmissions.appointmentId, a.id),
          eq(paymentReceipts.verificationStatus, "pending_upload"),
          gt(paymentReceipts.uploadExpiresAt, new Date()),
        ),
      )
      .limit(1);
    if (active.length) throw new AppError(409, "UPLOAD_ALREADY_PENDING");
    await tx
      .update(paymentReceipts)
      .set({ verificationStatus: "rejected", scanStatus: "upload_expired" })
      .where(
        and(
          eq(paymentReceipts.patientId, user.id),
          eq(paymentReceipts.verificationStatus, "pending_upload"),
          sql`${paymentReceipts.uploadExpiresAt} <= now()`,
        ),
      );
    const [payment] = await tx
      .insert(paymentSubmissions)
      .values({
        appointmentId: a.id,
        bankAccountId: bank.id,
        transactionReference: data.transactionReference,
        status: "awaiting_payment",
      })
      .returning();
    const pathname = `payment-receipts/${payment.id}/${randomUUID()}`;
    const [setting] = await tx
      .select({ value: websiteSettings.value })
      .from(websiteSettings)
      .where(eq(websiteSettings.key, "receipt_storage"));
    const policy = parseReceiptPolicy(setting?.value);
    const keepDays = Math.max(
      7,
      policy.retentionDays,
      policy.mandatoryRetentionDays || 7,
    );
    const [receipt] = await tx
      .insert(paymentReceipts)
      .values({
        paymentId: payment.id,
        patientId: user.id,
        provider: "vercel_blob",
        objectKey: pathname,
        blobPathname: pathname,
        originalFilename: sanitizeReceiptFilename(data.originalFilename),
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        sha256: "0".repeat(64),
        verificationStatus: "pending_upload",
        scanStatus: "pending",
        retainedUntil: new Date(Date.now() + keepDays * 86400000),
        uploadExpiresAt: new Date(Date.now() + 10 * 60000),
        uploadIdempotencyKey: data.idempotencyKey,
      })
      .returning({ id: paymentReceipts.id });
    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: "receipt.prepare",
      entityType: "receipt",
      entityId: receipt.id,
    });
    return {
      receiptId: receipt.id,
      pathname,
      verificationStatus: "pending_upload",
    };
  });
}
export async function authorizeReceiptUpload(
  receiptId: string,
  pathname: string,
) {
  const user = await requireUser();
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock_shared(hashtext('receipt-cleanup'))`,
    );
    const [r] = await tx
      .select({ receipt: paymentReceipts, appointment: appointments })
      .from(paymentReceipts)
      .innerJoin(
        paymentSubmissions,
        eq(paymentSubmissions.id, paymentReceipts.paymentId),
      )
      .innerJoin(
        appointments,
        eq(appointments.id, paymentSubmissions.appointmentId),
      )
      .where(eq(paymentReceipts.id, receiptId))
      .for("update");
    if (!r || r.receipt.patientId !== user.id)
      throw new AppError(404, "NOT_FOUND");
    if (r.receipt.provider !== "vercel_blob")
      throw new AppError(403, "FORBIDDEN");
    let grant;
    try {
      grant = receiptUploadGrant({
        receiptId: r.receipt.id,
        patientId: r.receipt.patientId,
        actorId: user.id,
        pathname,
        expectedPathname: r.receipt.blobPathname,
        mimeType: r.receipt.mimeType,
        fileSize: r.receipt.fileSize,
        expiresAt: r.receipt.uploadExpiresAt,
        tokenIssueCount: r.receipt.tokenIssueCount,
        verificationStatus: r.receipt.verificationStatus,
        paymentStatus: r.appointment.paymentStatus,
        appointmentStatus: r.appointment.status,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_INPUT";
      throw new AppError(code === "FORBIDDEN" ? 403 : 409, code);
    }
    await tx
      .update(paymentReceipts)
      .set({ tokenIssueCount: r.receipt.tokenIssueCount + 1 })
      .where(eq(paymentReceipts.id, receiptId));
    return grant;
  });
}
export async function completeReceipt(receiptId: string, actorId?: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock_shared(hashtext('receipt-cleanup'))`,
    );
    const [r] = await tx
      .select({
        receipt: paymentReceipts,
        payment: paymentSubmissions,
        appointment: appointments,
      })
      .from(paymentReceipts)
      .innerJoin(
        paymentSubmissions,
        eq(paymentSubmissions.id, paymentReceipts.paymentId),
      )
      .innerJoin(
        appointments,
        eq(appointments.id, paymentSubmissions.appointmentId),
      )
      .where(eq(paymentReceipts.id, receiptId))
      .for("update");
    if (!r || (actorId && actorId !== r.receipt.patientId))
      throw new AppError(404, "NOT_FOUND");
    if (r.receipt.verificationStatus !== "pending_upload")
      return {
        id: r.receipt.id,
        verificationStatus: r.receipt.verificationStatus,
      };
    if (!r.receipt.blobPathname || r.receipt.provider !== "vercel_blob")
      throw new AppError(409, "INVALID_TRANSITION");
    if (
      !uploadable.includes(r.appointment.paymentStatus) ||
      ["cancelled", "expired", "rejected", "completed"].includes(
        r.appointment.status,
      )
    )
      throw new AppError(409, "INVALID_TRANSITION");
    const transition = receiptReviewTransition(
      r.appointment.status,
      r.appointment.paymentStatus,
    );
    let inspected;
    try {
      inspected = await inspectPrivateReceipt(privateReceiptStorage, {
        blobPathname: r.receipt.blobPathname,
        mimeType: r.receipt.mimeType,
        fileSize: r.receipt.fileSize,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (["INVALID_FILE_SIZE", "INVALID_FILE_SIGNATURE"].includes(code)) {
        await tx
          .update(paymentReceipts)
          .set({
            verificationStatus: "rejected",
            scanStatus: "invalid_file",
            lastDeletionError: null,
            uploadedAt: new Date(),
          })
          .where(eq(paymentReceipts.id, receiptId));
        await tx
          .update(paymentSubmissions)
          .set({ status: "rejected" })
          .where(eq(paymentSubmissions.id, r.payment.id));
        await tx.insert(auditLogs).values({
          actorId: r.receipt.patientId,
          action: "receipt.invalid_file",
          entityType: "receipt",
          entityId: receiptId,
        });
        return { id: receiptId, verificationStatus: "rejected" };
      }
      if (code === "BLOB_NOT_FOUND")
        throw new AppError(409, "UPLOAD_NOT_READY");
      throw error;
    }
    const [setting] = await tx
      .select({ value: websiteSettings.value })
      .from(websiteSettings)
      .where(eq(websiteSettings.key, "receipt_storage"));
    const policy = parseReceiptPolicy(setting?.value);
    const now = new Date();
    await tx
      .update(paymentReceipts)
      .set({
        mimeType: inspected.mimeType,
        fileSize: inspected.fileSize,
        sha256: inspected.sha256,
        verificationStatus: transition.verificationStatus,
        scanStatus: "signature_verified_not_malware_scanned",
        uploadedAt: now,
        retainedUntil: new Date(
          now.getTime() +
            Math.max(
              7,
              policy.retentionDays,
              policy.mandatoryRetentionDays || 7,
            ) *
              86400000,
        ),
      })
      .where(eq(paymentReceipts.id, receiptId));
    await tx
      .update(paymentSubmissions)
      .set({ status: "under_review" })
      .where(eq(paymentSubmissions.id, r.payment.id));
    await tx
      .update(appointments)
      .set({
        paymentStatus: transition.paymentStatus,
        status: transition.appointmentStatus,
        updatedAt: now,
      })
      .where(eq(appointments.id, r.appointment.id));
    await tx.insert(appointmentStatusHistory).values({
      appointmentId: r.appointment.id,
      actorId: r.receipt.patientId,
      fromState: r.appointment.status,
      toState: "awaiting_verification",
    });
    await tx
      .insert(notifications)
      .values({
        userId: r.receipt.patientId,
        appointmentId: r.appointment.id,
        event: "receipt_submitted",
        dedupeKey: `receipt:${receiptId}`,
      })
      .onConflictDoNothing();
    await tx.insert(auditLogs).values({
      actorId: r.receipt.patientId,
      action: "receipt.upload_validated",
      entityType: "receipt",
      entityId: receiptId,
    });
    return { id: receiptId, verificationStatus: "under_review" };
  });
}
export async function receiptStatus(id: string) {
  const auth = await currentUser();
  if (!auth) throw new AppError(401, "SIGN_IN_REQUIRED");
  const [r] = await getDb()
    .select()
    .from(paymentReceipts)
    .where(eq(paymentReceipts.id, id));
  if (
    !r ||
    !receiptAccessAllowed(
      {
        id: auth.user.id,
        role: auth.user.role,
        mfaVerifiedAt: auth.mfaVerifiedAt,
      },
      r.patientId,
    )
  )
    throw new AppError(404, "NOT_FOUND");
  return {
    id: r.id,
    paymentId: r.paymentId,
    verificationStatus: r.verificationStatus,
    deletionStatus: r.deletionStatus,
    deletedAt: r.deletedAt,
  };
}
export async function downloadReceipt(id: string) {
  const auth = await currentUser();
  if (!auth) throw new AppError(401, "SIGN_IN_REQUIRED");
  const [r] = await getDb()
    .select()
    .from(paymentReceipts)
    .where(eq(paymentReceipts.id, id));
  if (
    !r ||
    !receiptAccessAllowed(
      {
        id: auth.user.id,
        role: auth.user.role,
        mfaVerifiedAt: auth.mfaVerifiedAt,
      },
      r.patientId,
    )
  )
    throw new AppError(404, "NOT_FOUND");
  if (r.deletedAt || r.deletionStatus === "deleted")
    throw new AppError(410, "RECEIPT_DELETED");
  if (
    r.provider !== "vercel_blob" ||
    !r.blobPathname ||
    !["under_review", "approved", "rejected", "refunded"].includes(
      r.verificationStatus,
    ) ||
    r.scanStatus === "invalid_file"
  )
    throw new AppError(404, "NOT_FOUND");
  const object = await privateReceiptStorage.get(r.blobPathname);
  if (!object) throw new AppError(404, "NOT_FOUND");
  await getDb().insert(auditLogs).values({
    actorId: auth.user.id,
    action: "receipt.download",
    entityType: "receipt",
    entityId: id,
  });
  const extension =
    r.mimeType === "application/pdf"
      ? "pdf"
      : r.mimeType === "image/jpeg"
        ? "jpg"
        : r.mimeType === "image/webp"
          ? "webp"
          : "png";
  return new Response(object.stream, {
    headers: {
      "Content-Type": r.mimeType,
      "Content-Disposition": `attachment; filename="receipt.${extension}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "Vercel-CDN-Cache-Control": "no-store",
      "CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
