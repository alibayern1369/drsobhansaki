import { z } from "zod";
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export const receiptPolicySchema = z
  .object({
    enabled: z.boolean(),
    dryRun: z.boolean(),
    retentionDays: z.number().int().min(7).max(3650),
    mandatoryRetentionDays: z.number().int().min(7).max(3650).nullable(),
    policyApproved: z.boolean(),
  })
  .refine((p) => !p.policyApproved || p.mandatoryRetentionDays !== null, {
    message: "Mandatory retention must be reviewed before approval",
  });
export type ReceiptPolicy = z.infer<typeof receiptPolicySchema>;
export const DEFAULT_RECEIPT_POLICY: ReceiptPolicy = {
  enabled: false,
  dryRun: true,
  retentionDays: 7,
  mandatoryRetentionDays: null,
  policyApproved: false,
};
export function parseReceiptPolicy(value: unknown): ReceiptPolicy {
  const parsed = receiptPolicySchema.safeParse(value);
  return parsed.success ? parsed.data : { ...DEFAULT_RECEIPT_POLICY };
}
export function sanitizeReceiptFilename(value: string) {
  return (
    value
      .split(/[\\/]/)
      .pop()!
      .normalize("NFC")
      .replace(/[\x00-\x1f\x7f]/g, "")
      .slice(0, 160) || "receipt"
  );
}
export type ReceiptActor = {
  id: string;
  role: string;
  mfaVerifiedAt: Date | null;
};
export function receiptAccessAllowed(
  actor: ReceiptActor | null,
  patientId: string,
  now = new Date(),
) {
  if (!actor) return false;
  if (actor.id === patientId) return true;
  return (
    ["doctor", "super_admin"].includes(actor.role) &&
    !!actor.mfaVerifiedAt &&
    actor.mfaVerifiedAt.getTime() > now.getTime() - 900000
  );
}
export type ReceiptDeletionCandidate = {
  id: string;
  provider: string;
  blobPathname: string | null;
  uploadedAt: Date;
  verificationStatus: string;
  paymentStatus: string;
  submissionStatus: string;
  deletionStatus: string;
  deletedAt: Date | null;
  disputeActive: boolean;
  retentionHold: boolean;
  paymentRetentionHold: boolean;
  legalRetentionHold: boolean;
  retainedUntil: Date;
  legalRetentionUntil: Date | null;
  nextDeletionAttemptAt?: Date | null;
  deletionAttempts: number;
};
export function deletionBlockReason(
  r: ReceiptDeletionCandidate,
  p: ReceiptPolicy,
  now = new Date(),
): string | null {
  if (r.deletedAt || r.deletionStatus === "deleted") return "already_deleted";
  if (r.provider !== "vercel_blob" || !r.blobPathname)
    return "unsupported_provider";
  if (p.mandatoryRetentionDays === null)
    return "retention_requirement_unreviewed";
  const final = ["approved", "rejected", "refunded"];
  if (
    !final.includes(r.paymentStatus) ||
    !final.includes(r.submissionStatus) ||
    !final.includes(r.verificationStatus)
  )
    return "verification_pending";
  if (r.disputeActive) return "disputed";
  if (r.retentionHold || r.paymentRetentionHold) return "retention_hold";
  if (r.legalRetentionHold) return "legal_hold";
  const days = Math.max(7, p.retentionDays, p.mandatoryRetentionDays);
  if (
    !Number.isFinite(r.uploadedAt.getTime()) ||
    r.uploadedAt.getTime() + days * 86400000 > now.getTime()
  )
    return "too_young";
  if (
    r.retainedUntil > now ||
    (r.legalRetentionUntil && r.legalRetentionUntil > now)
  )
    return "retention_requirement";
  if (r.nextDeletionAttemptAt && r.nextDeletionAttemptAt > now)
    return "retry_not_due";
  return null;
}
export async function deleteReceiptObject(
  candidate: ReceiptDeletionCandidate,
  policy: ReceiptPolicy,
  storage: { del: (pathname: string) => Promise<void> },
  options: { forceDryRun?: boolean; allowDelete: boolean; now?: Date },
) {
  const now = options.now || new Date();
  const blocked = deletionBlockReason(candidate, policy, now);
  if (blocked) return { status: "blocked" as const, reason: blocked };
  if (
    options.forceDryRun ||
    policy.dryRun ||
    !policy.policyApproved ||
    !policy.enabled ||
    !options.allowDelete
  )
    return { status: "would_delete" as const };
  try {
    await storage.del(candidate.blobPathname!);
    return {
      status: "deleted" as const,
      deletedAt: now,
      attempts: candidate.deletionAttempts + 1,
    };
  } catch {
    return {
      status: "failed" as const,
      attempts: candidate.deletionAttempts + 1,
      error: "BLOB_DELETE_FAILED",
      retryAt: new Date(
        now.getTime() +
          Math.min(
            86400000,
            3600000 * 2 ** Math.min(candidate.deletionAttempts, 5),
          ),
      ),
    };
  }
}
