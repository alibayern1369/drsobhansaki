import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { otpChallenges, users } from "@/db/schema";
import { phoneSchema } from "@/lib/domain";
import {
  AppError,
  createSession,
  otpHash,
  rateLimit,
  requestKey,
} from "./security";
import { sendSms } from "./sms";
import {
  PATIENT_TEST_CODE,
  patientChallengeValue,
  patientTestAccountAllowed,
} from "@/lib/test-login";
import { patientTestMode } from "./patient-login-settings";
export async function requestOtp(phone: string) {
  phoneSchema.parse(phone);
  await rateLimit(`otp:ip:${await requestKey()}`, 15, 900);
  await rateLimit(`otp:phone:${phone}`, 3, 600);
  await rateLimit(`otp:cooldown:${phone}`, 1, 60);
  const dev =
    process.env.NODE_ENV !== "production" &&
    process.env.SMS_PROVIDER === "development";
  const db = getDb();
  const { code, testMode } = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('patient-login-mode'))`,
    );
    const testMode = await patientTestMode(tx);
    if (testMode) {
      const [existing] = await tx
        .select({ role: users.role, disabled: users.disabled })
        .from(users)
        .where(eq(users.phone, phone));
      if (!patientTestAccountAllowed(existing))
        throw new AppError(403, "FORBIDDEN");
    }
    const code = testMode
      ? PATIENT_TEST_CODE
      : dev
        ? process.env.DEV_OTP_CODE
        : String(randomInt(100000, 1000000));
    if (!code || !/^\d{6}$/.test(code))
      throw new AppError(503, "AUTH_NOT_CONFIGURED");
    const digest = otpHash(phone, patientChallengeValue(code, testMode));
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${phone}))`);
    await tx
      .update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(
        and(eq(otpChallenges.phone, phone), isNull(otpChallenges.consumedAt)),
      );
    await tx.insert(otpChallenges).values({
      phone,
      codeHash: digest,
      expiresAt: new Date(Date.now() + 300000),
    });
    return { code, testMode };
  });
  if (testMode) return { testMode: true };
  try {
    await sendSms(
      phone,
      `کد ورود شما: ${code}\nاین کد را در اختیار دیگران نگذارید.`,
      code,
    );
  } catch (e) {
    await db
      .update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(
        and(eq(otpChallenges.phone, phone), isNull(otpChallenges.consumedAt)),
      );
    throw e;
  }
  return { testMode: false };
}
export async function verifyOtp(phone: string, code: string) {
  phoneSchema.parse(phone);
  if (!/^\d{6}$/.test(code)) throw new AppError(400, "INVALID_OTP");
  await rateLimit(`verify:${await requestKey()}`, 30, 900);
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('patient-login-mode'))`,
    );
    const testMode = await patientTestMode(tx);
    const [challenge] = await tx
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.phone, phone),
          isNull(otpChallenges.consumedAt),
          gt(otpChallenges.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1)
      .for("update");
    if (!challenge || challenge.attempts >= 5) return null;
    await tx
      .update(otpChallenges)
      .set({ attempts: challenge.attempts + 1 })
      .where(eq(otpChallenges.id, challenge.id));
    if (
      !timingSafeEqual(
        Buffer.from(challenge.codeHash),
        Buffer.from(otpHash(phone, patientChallengeValue(code, testMode))),
      )
    )
      return null;
    await tx
      .update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(otpChallenges.id, challenge.id));
    const [user] = await tx
      .insert(users)
      .values({ phone })
      .onConflictDoUpdate({
        target: users.phone,
        set: { updatedAt: new Date() },
      })
      .returning();
    if (user.disabled || (testMode && !patientTestAccountAllowed(user)))
      return null;
    await createSession(user.id, false, tx);
    return user;
  });
  if (!result) throw new AppError(400, "INVALID_OTP");
  return result;
}
