import "server-only";
import { and, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appointments,
  paymentReceipts,
  paymentSubmissions,
  receiptCleanupRuns,
  websiteSettings,
} from "@/db/schema";
import {
  deleteReceiptObject,
  parseReceiptPolicy,
  type ReceiptDeletionCandidate,
} from "@/lib/receipt-policy";
import { privateReceiptStorage } from "./blob-store";
export async function runReceiptCleanup(forceDryRun = false) {
  const startedAt = new Date();
  return getDb().transaction(async (tx) => {
    const lock = await tx.execute(
      sql`select pg_try_advisory_xact_lock(hashtext('receipt-cleanup')) as acquired`,
    );
    if (!lock.rows[0]?.acquired)
      return {
        status: "overlap_skipped",
        dryRun: true,
        scanned: 0,
        eligible: 0,
        deleted: 0,
        errors: 0,
      };
    const [setting] = await tx
      .select()
      .from(websiteSettings)
      .where(eq(websiteSettings.key, "receipt_storage"))
      .for("share");
    const policy = parseReceiptPolicy(setting?.value);
    const dryRun =
      forceDryRun ||
      policy.dryRun ||
      !policy.policyApproved ||
      process.env.RECEIPT_CLEANUP_ALLOW_DELETE !== "true";
    const summary = {
      status:
        !policy.enabled && !forceDryRun
          ? "disabled"
          : policy.mandatoryRetentionDays === null
            ? "policy_unreviewed"
            : "completed",
      dryRun,
      scanned: 0,
      eligible: 0,
      deleted: 0,
      errors: 0,
      blockedReasons: {} as Record<string, number>,
    };
    if (summary.status === "completed") {
      const now = new Date();
      const cutoff = new Date(
        now.getTime() -
          Math.max(
            7,
            policy.retentionDays,
            policy.mandatoryRetentionDays || 7,
          ) *
            86400000,
      );
      const final = ["approved", "rejected", "refunded"] as const;
      const rows = await tx
        .select({
          receipt: paymentReceipts,
          payment: paymentSubmissions,
          appointmentPaymentStatus: appointments.paymentStatus,
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
        .where(
          and(
            eq(paymentReceipts.provider, "vercel_blob"),
            ne(paymentReceipts.deletionStatus, "deleted"),
            isNull(paymentReceipts.deletedAt),
            inArray(paymentReceipts.verificationStatus, [...final]),
            inArray(paymentSubmissions.status, [...final]),
            inArray(appointments.paymentStatus, [...final]),
            eq(paymentSubmissions.disputeActive, false),
            eq(paymentSubmissions.retentionHold, false),
            eq(paymentReceipts.retentionHold, false),
            eq(paymentReceipts.legalRetentionHold, false),
            lte(paymentReceipts.uploadedAt, cutoff),
            lte(paymentReceipts.retainedUntil, now),
            or(
              isNull(paymentSubmissions.legalRetentionUntil),
              lte(paymentSubmissions.legalRetentionUntil, now),
            ),
            or(
              isNull(paymentReceipts.nextDeletionAttemptAt),
              lte(paymentReceipts.nextDeletionAttemptAt, now),
            ),
          ),
        )
        .orderBy(paymentReceipts.uploadedAt)
        .limit(25)
        .for("update", { skipLocked: true });
      for (const row of rows) {
        if (Date.now() - startedAt.getTime() > 40000) {
          summary.status = "partial";
          break;
        }
        summary.scanned++;
        const r = row.receipt;
        const candidate: ReceiptDeletionCandidate = {
          id: r.id,
          provider: r.provider,
          blobPathname: r.blobPathname,
          uploadedAt: r.uploadedAt,
          verificationStatus: r.verificationStatus,
          paymentStatus: row.appointmentPaymentStatus,
          submissionStatus: row.payment.status,
          deletionStatus: r.deletionStatus,
          deletedAt: r.deletedAt,
          disputeActive: row.payment.disputeActive,
          retentionHold: r.retentionHold,
          paymentRetentionHold: row.payment.retentionHold,
          legalRetentionHold: r.legalRetentionHold,
          retainedUntil: r.retainedUntil,
          legalRetentionUntil: row.payment.legalRetentionUntil,
          nextDeletionAttemptAt: r.nextDeletionAttemptAt,
          deletionAttempts: r.deletionAttempts,
        };
        const outcome = await deleteReceiptObject(
          candidate,
          policy,
          privateReceiptStorage,
          {
            forceDryRun: dryRun,
            allowDelete: process.env.RECEIPT_CLEANUP_ALLOW_DELETE === "true",
            now: new Date(),
          },
        );
        if (outcome.status === "blocked") {
          summary.blockedReasons[outcome.reason] =
            (summary.blockedReasons[outcome.reason] || 0) + 1;
          continue;
        }
        summary.eligible++;
        if (outcome.status === "deleted") {
          await tx
            .update(paymentReceipts)
            .set({
              deletionStatus: "deleted",
              deletedAt: outcome.deletedAt,
              deletionAttempts: outcome.attempts,
              lastDeletionError: null,
              nextDeletionAttemptAt: null,
            })
            .where(eq(paymentReceipts.id, r.id));
          summary.deleted++;
        } else if (outcome.status === "failed") {
          await tx
            .update(paymentReceipts)
            .set({
              deletionStatus: "error",
              deletionAttempts: outcome.attempts,
              lastDeletionError: outcome.error,
              nextDeletionAttemptAt: outcome.retryAt,
            })
            .where(eq(paymentReceipts.id, r.id));
          summary.errors++;
        }
      }
    }
    await tx
      .insert(receiptCleanupRuns)
      .values({ startedAt, finishedAt: new Date(), ...summary });
    return summary;
  });
}
export async function receiptStorageOverview() {
  const db = getDb();
  const [setting] = await db
    .select()
    .from(websiteSettings)
    .where(eq(websiteSettings.key, "receipt_storage"));
  const [lastRun] = await db
    .select()
    .from(receiptCleanupRuns)
    .orderBy(desc(receiptCleanupRuns.startedAt))
    .limit(1);
  const result = await db.execute(
    sql`select coalesce(sum(size_bytes),0)::bigint as tracked_bytes, count(*)::int as tracked_files from payment_receipts where provider='vercel_blob' and deleted_at is null and verification_status <> 'pending_upload'`,
  );
  return {
    policy: parseReceiptPolicy(setting?.value),
    deletionInterlockEnabled:
      process.env.RECEIPT_CLEANUP_ALLOW_DELETE === "true",
    blobConfigured: !!process.env.BLOB_READ_WRITE_TOKEN,
    lastRun: lastRun || null,
    trackedBytes: Number(result.rows[0]?.tracked_bytes || 0),
    trackedFiles: Number(result.rows[0]?.tracked_files || 0),
  };
}
