import "server-only";
import { and, eq, lt, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { appointments, notifications, users, smsTemplates } from "@/db/schema";
import { sendSms } from "./sms";
export async function runJobs() {
  const db = getDb();
  await db
    .update(appointments)
    .set({ status: "expired", paymentStatus: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(appointments.status, "awaiting_payment"),
        lt(appointments.expiresAt, new Date()),
      ),
    );
  const claimed = await db.transaction(async (tx) => {
    const batch = await tx
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.status, "pending"),
          lte(notifications.nextAttemptAt, new Date()),
        ),
      )
      .limit(20)
      .for("update", { skipLocked: true });
    for (const n of batch)
      await tx
        .update(notifications)
        .set({ status: "sending", attempts: n.attempts + 1 })
        .where(eq(notifications.id, n.id));
    return batch;
  });
  let sent = 0;
  let failed = 0;
  for (const n of claimed) {
    try {
      const [user] = await db
        .select({ phone: users.phone })
        .from(users)
        .where(eq(users.id, n.userId));
      const [template] = await db
        .select()
        .from(smsTemplates)
        .where(
          and(eq(smsTemplates.key, n.event), eq(smsTemplates.enabled, true)),
        );
      if (!user || !template)
        throw new Error("Notification configuration missing");
      const content = template.content as { fa?: string };
      if (!content.fa) throw new Error("Template missing");
      const result = await sendSms(user.phone, content.fa);
      await db
        .update(notifications)
        .set({ status: "sent", providerId: result.id })
        .where(eq(notifications.id, n.id));
      sent++;
    } catch {
      await db
        .update(notifications)
        .set({
          status: n.attempts + 1 >= 5 ? "failed" : "pending",
          nextAttemptAt: new Date(
            Date.now() + Math.min(3600000, 60000 * 2 ** n.attempts),
          ),
        })
        .where(eq(notifications.id, n.id));
      failed++;
    }
  }
  return { sent, failed };
}
