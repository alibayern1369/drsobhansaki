import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, websiteSettings } from "@/db/schema";
import { receiptPolicySchema, parseReceiptPolicy } from "@/lib/receipt-policy";
import { AppError, checkOrigin, requireUser } from "@/server/security";
import {
  receiptStorageOverview,
  runReceiptCleanup,
} from "@/server/receipt-cleanup";
import { receiptJson, receiptError, smallJson } from "@/server/receipt-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function administrator() {
  const user = await requireUser(true);
  if (!["doctor", "super_admin"].includes(user.role))
    throw new AppError(403, "FORBIDDEN");
  return user;
}
export async function GET(request: Request) {
  try {
    await administrator();
    return receiptJson(await receiptStorageOverview());
  } catch (error) {
    return receiptError(error, request);
  }
}
export async function PUT(request: Request) {
  try {
    await checkOrigin(request);
    const user = await administrator();
    const input = await smallJson(request);
    const policy = receiptPolicySchema.parse(input);
    const acknowledged =
      (input as { approvalAcknowledged?: unknown }).approvalAcknowledged ===
      true;
    await getDb().transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('receipt-cleanup'))`,
      );
      const [previous] = await tx
        .select()
        .from(websiteSettings)
        .where(eq(websiteSettings.key, "receipt_storage"));
      const before = parseReceiptPolicy(previous?.value);
      const changed =
        !before.policyApproved ||
        before.retentionDays !== policy.retentionDays ||
        before.mandatoryRetentionDays !== policy.mandatoryRetentionDays;
      if (
        policy.policyApproved &&
        changed &&
        (!acknowledged || user.role !== "super_admin")
      )
        throw new AppError(403, "POLICY_APPROVAL_REQUIRED");
      const value = {
        ...policy,
        ...(policy.policyApproved
          ? {
              approvedBy: changed
                ? user.id
                : (previous?.value as Record<string, unknown>)?.approvedBy,
              approvedAt: changed
                ? new Date().toISOString()
                : (previous?.value as Record<string, unknown>)?.approvedAt,
            }
          : {}),
      };
      await tx
        .insert(websiteSettings)
        .values({ key: "receipt_storage", value, updatedBy: user.id })
        .onConflictDoUpdate({
          target: websiteSettings.key,
          set: { value, updatedBy: user.id, updatedAt: new Date() },
        });
      await tx
        .insert(auditLogs)
        .values({
          actorId: user.id,
          action: "receipt_storage.policy_update",
          entityType: "settings",
          entityId: "receipt_storage",
          metadata: policy,
        });
    });
    return receiptJson({ ok: true });
  } catch (error) {
    return receiptError(error, request);
  }
}
export async function POST(request: Request) {
  try {
    await checkOrigin(request);
    await administrator();
    return receiptJson(await runReceiptCleanup(true));
  } catch (error) {
    return receiptError(error, request);
  }
}
