import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, paymentReceipts, paymentSubmissions } from "@/db/schema";
import { requireUser, checkOrigin, AppError } from "@/server/security";
import { receiptJson, receiptError, smallJson } from "@/server/receipt-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  try {
    await checkOrigin(request);
    const user = await requireUser(true);
    if (!["doctor", "super_admin"].includes(user.role))
      throw new AppError(403, "FORBIDDEN");
    const { receiptId } = await params;
    const id = z.uuid().parse(receiptId);
    const data = z
      .object({
        retentionHold: z.boolean(),
        legalRetentionHold: z.boolean(),
        disputeActive: z.boolean(),
        legalRetentionUntil: z.iso.datetime().nullable(),
      })
      .parse(await smallJson(request));
    await getDb().transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('receipt-cleanup'))`,
      );
      const [receipt] = await tx
        .select()
        .from(paymentReceipts)
        .where(eq(paymentReceipts.id, id))
        .for("update");
      if (!receipt) throw new AppError(404, "NOT_FOUND");
      if (receipt.deletedAt) throw new AppError(410, "RECEIPT_DELETED");
      await tx
        .update(paymentReceipts)
        .set({
          retentionHold: data.retentionHold,
          legalRetentionHold: data.legalRetentionHold,
        })
        .where(eq(paymentReceipts.id, id));
      await tx
        .update(paymentSubmissions)
        .set({
          disputeActive: data.disputeActive,
          legalRetentionUntil: data.legalRetentionUntil
            ? new Date(data.legalRetentionUntil)
            : null,
        })
        .where(eq(paymentSubmissions.id, receipt.paymentId));
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "receipt.retention_update",
        entityType: "receipt",
        entityId: id,
        metadata: data,
      });
    });
    return receiptJson({ ok: true });
  } catch (error) {
    return receiptError(error, request);
  }
}
