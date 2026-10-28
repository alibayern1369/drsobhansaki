import { eq } from "drizzle-orm";
import type { getDb } from "@/db";
import { auditLogs, bankAccounts, paymentSubmissions } from "@/db/schema";

// Keep the bank row for historical payments, but remove it from active lists.
export async function archiveBankAccount(
  db: Pick<ReturnType<typeof getDb>, "transaction">,
  id: string,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [bank] = await tx
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .for("update");
    if (!bank) return null;
    const [receipt] = await tx
      .select({ id: paymentSubmissions.id })
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.bankAccountId, id))
      .limit(1);
    const now = new Date();
    await tx
      .update(bankAccounts)
      .set({ enabled: false, deletedAt: now, updatedAt: now })
      .where(eq(bankAccounts.id, id));
    await tx.insert(auditLogs).values({
      actorId,
      action: "bank.delete",
      entityType: "bank",
      entityId: id,
    });
    return { retained: !!receipt };
  });
}
