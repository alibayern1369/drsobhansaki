import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { sessions, rateLimits, auditLogs, adminCredentials } from "@/db/schema";
import { AppError, hash, rateLimit, requireUser } from "./security";
function decodeBase32(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of input.toUpperCase().replace(/=+$/, "")) {
    const n = alphabet.indexOf(c);
    if (n < 0) throw new AppError(503, "MFA_NOT_CONFIGURED");
    bits += n.toString(2).padStart(5, "0");
  }
  return Buffer.from(bits.match(/.{8}/g)?.map((x) => parseInt(x, 2)) || []);
}
export async function verifyMfa(code: string) {
  const user = await requireUser();
  const [credential] = await getDb()
    .select({ userId: adminCredentials.userId })
    .from(adminCredentials)
    .where(eq(adminCredentials.userId, user.id));
  if (credential) {
    const { adminAccess } = await import("./admin-access");
    await adminAccess("verify", "POST", { method: "totp", code });
    return;
  }
  if (!["doctor", "super_admin", "staff"].includes(user.role))
    throw new AppError(403, "FORBIDDEN");
  const secrets: Record<string, string> = JSON.parse(
    process.env.ADMIN_TOTP_SECRETS || "{}",
  );
  if (!secrets[user.id]) throw new AppError(503, "MFA_NOT_CONFIGURED");
  await rateLimit(`mfa:${user.id}`, 5, 300);
  const key = decodeBase32(secrets[user.id]);
  let counter: number | null = null;
  for (let drift = -1; drift <= 1; drift++) {
    const step = Math.floor(Date.now() / 30000) + drift;
    const bytes = Buffer.alloc(8);
    bytes.writeBigUInt64BE(BigInt(step));
    const mac = createHmac("sha1", key).update(bytes).digest();
    const offset = mac[19] & 15;
    const otp = String(
      (mac.readUInt32BE(offset) & 0x7fffffff) % 1000000,
    ).padStart(6, "0");
    if (
      code.length === 6 &&
      timingSafeEqual(Buffer.from(code), Buffer.from(otp))
    )
      counter = step;
  }
  if (counter === null) throw new AppError(400, "INVALID_OTP");
  const token = (await cookies()).get("medical_session")?.value;
  if (!token) throw new AppError(401, "SIGN_IN_REQUIRED");
  await getDb().transaction(async (tx) => {
    const replay = `mfa-used:${user.id}:${counter}`;
    const inserted = await tx
      .insert(rateLimits)
      .values({
        key: replay,
        count: 1,
        resetsAt: new Date(Date.now() + 120000),
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) throw new AppError(400, "INVALID_OTP");
    await tx
      .update(sessions)
      .set({ mfaVerifiedAt: new Date() })
      .where(
        and(eq(sessions.tokenHash, hash(token)), eq(sessions.userId, user.id)),
      );
    await tx
      .insert(auditLogs)
      .values({ actorId: user.id, action: "auth.mfa", entityType: "session" });
  });
}
