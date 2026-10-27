import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { adminCredentials, rateLimits, sessions, users } from "@/db/schema";
import { effectiveAdminVerification } from "@/lib/admin-crypto";
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export function otpHash(phone: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(503, "AUTH_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}
export async function currentUser() {
  if (!process.env.DATABASE_URL) return null;
  const token = (await cookies()).get("medical_session")?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({
      user: users,
      mfaVerifiedAt: sessions.mfaVerifiedAt,
      passwordVerified: sessions.adminPasswordVerified,
      credential: {
        smsEnabled: adminCredentials.smsEnabled,
        totpEnabled: adminCredentials.totpEnabled,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(adminCredentials, eq(adminCredentials.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hash(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.disabled, false),
      ),
    )
    .limit(1);
  return row
    ? {
        ...row,
        mfaVerifiedAt: effectiveAdminVerification(
          row.passwordVerified,
          row.credential,
          row.mfaVerifiedAt,
        ),
      }
    : null;
}
export async function requireUser(admin = false) {
  const auth = await currentUser();
  if (!auth) throw new AppError(401, "SIGN_IN_REQUIRED");
  if (
    admin &&
    (!["doctor", "super_admin", "staff"].includes(auth.user.role) ||
      !auth.mfaVerifiedAt ||
      auth.mfaVerifiedAt.getTime() < Date.now() - 15 * 60 * 1000)
  )
    throw new AppError(403, "ADMIN_MFA_REQUIRED");
  return auth.user;
}
export async function createSession(
  userId: string,
  adminPasswordVerified = false,
) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 7 * 86400000);
  await getDb()
    .insert(sessions)
    .values({
      userId,
      tokenHash: hash(token),
      expiresAt: expires,
      adminPasswordVerified,
    });
  (await cookies()).set("medical_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}
export async function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const allowed = new Set([new URL(expected).origin]);
  // Vercel preview deployments use their own host while retaining production settings.
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    allowed.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (!origin || !allowed.has(origin))
    throw new AppError(403, "INVALID_ORIGIN");
}
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number,
) {
  const db = getDb();
  const now = new Date();
  const [r] = await db
    .insert(rateLimits)
    .values({
      key,
      count: 1,
      resetsAt: new Date(now.getTime() + windowSeconds * 1000),
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetsAt} <= ${now} then 1 else ${rateLimits.count}+1 end`,
        resetsAt: sql`case when ${rateLimits.resetsAt} <= ${now} then ${new Date(now.getTime() + windowSeconds * 1000)} else ${rateLimits.resetsAt} end`,
      },
    })
    .returning({ count: rateLimits.count });
  if (r.count > max) throw new AppError(429, "RATE_LIMITED");
}
export async function requestKey() {
  const h = await headers();
  return hash(h.get("x-vercel-forwarded-for")?.split(",")[0] || "shared");
}
export function isMfaCurrent(date: Date | null) {
  return !!date && date.getTime() > Date.now() - 900000;
}
