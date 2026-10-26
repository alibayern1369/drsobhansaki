import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  adminCredentials,
  adminMfaChallenges,
  auditLogs,
  rateLimits,
  sessions,
  users,
} from "@/db/schema";
import {
  decryptSecret,
  encryptSecret,
  newTotpSecret,
  totpCounter,
  verifyPassword,
} from "@/lib/admin-crypto";
import {
  AppError,
  createSession,
  currentUser,
  hash,
  isMfaCurrent,
  otpHash,
  rateLimit,
  requestKey,
  requireUser,
} from "./security";
import {
  saveSmsSettings,
  settingsKey,
  storedSmsSettings,
} from "./integration-settings";
import { sendSms } from "./sms";
const passwordSchema = z.string().min(1).max(128);
const codeSchema = z.string().regex(/^\d{6}$/);
const dummy = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;
const roles = ["super_admin", "doctor", "staff"];
async function context() {
  const auth = await currentUser();
  if (!auth || !roles.includes(auth.user.role))
    throw new AppError(401, "SIGN_IN_REQUIRED");
  const [credential] = await getDb()
    .select()
    .from(adminCredentials)
    .where(eq(adminCredentials.userId, auth.user.id));
  if (!credential || !auth.passwordVerified)
    throw new AppError(401, "ADMIN_PASSWORD_REQUIRED");
  const token = (await cookies()).get("medical_session")?.value;
  if (!token) throw new AppError(401, "SIGN_IN_REQUIRED");
  return { auth, credential, sessionHash: hash(token) };
}
async function confirmPassword(value: unknown) {
  const ctx = await context();
  await rateLimit(`admin-password-confirm:${ctx.auth.user.id}`, 20, 900);
  if (
    !(await verifyPassword(
      passwordSchema.parse(value),
      ctx.credential.passwordHash,
    ))
  )
    throw new AppError(403, "INVALID_CREDENTIALS");
  return ctx;
}
async function audit(userId: string, action: string) {
  await getDb()
    .insert(auditLogs)
    .values({
      actorId: userId,
      action,
      entityType: "admin_security",
      entityId: userId,
    });
}
async function issueSms(ctx: Awaited<ReturnType<typeof context>>) {
  await rateLimit(`admin-sms:${ctx.auth.user.id}`, 3, 600);
  const code = String(randomInt(100000, 1000000));
  const value = {
    userId: ctx.auth.user.id,
    sessionHash: ctx.sessionHash,
    codeHash: otpHash(ctx.sessionHash, code),
    attempts: 0,
    expiresAt: new Date(Date.now() + 300000),
    consumedAt: null,
  };
  await getDb()
    .insert(adminMfaChallenges)
    .values(value)
    .onConflictDoUpdate({ target: adminMfaChallenges.sessionHash, set: value });
  try {
    await sendSms(ctx.auth.user.phone, `کد ورود مدیریت: ${code}`, code);
  } catch (error) {
    await getDb()
      .delete(adminMfaChallenges)
      .where(eq(adminMfaChallenges.sessionHash, ctx.sessionHash));
    throw error;
  }
}
async function consumeSms(sessionHash: string, code: string) {
  const result = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(adminMfaChallenges)
      .where(eq(adminMfaChallenges.sessionHash, sessionHash))
      .for("update");
    if (
      !row ||
      row.consumedAt ||
      row.attempts >= 5 ||
      row.expiresAt.getTime() < Date.now()
    )
      return false;
    await tx
      .update(adminMfaChallenges)
      .set({ attempts: row.attempts + 1 })
      .where(eq(adminMfaChallenges.sessionHash, sessionHash));
    if (row.codeHash !== otpHash(sessionHash, code)) return false;
    await tx
      .update(adminMfaChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(adminMfaChallenges.sessionHash, sessionHash));
    return true;
  });
  if (!result) throw new AppError(400, "INVALID_OTP");
}
export async function adminAccess(
  action: string,
  method: string,
  input: unknown,
) {
  const db = getDb();
  if (action === "login" && method === "POST") {
    const data = z
      .object({
        username: z.string().trim().min(3).max(64),
        password: passwordSchema,
      })
      .parse(input);
    const username = data.username.toLowerCase();
    await rateLimit(`admin-login-ip:${await requestKey()}`, 20, 900);
    await rateLimit(`admin-login-user:${hash(username)}`, 10, 900);
    const [row] = await db
      .select({ credential: adminCredentials, user: users })
      .from(adminCredentials)
      .innerJoin(users, eq(users.id, adminCredentials.userId))
      .where(eq(adminCredentials.username, username));
    const valid = await verifyPassword(
      data.password,
      row?.credential.passwordHash || dummy,
    );
    if (!valid || !row || row.user.disabled || !roles.includes(row.user.role))
      throw new AppError(401, "INVALID_CREDENTIALS");
    await createSession(row.user.id, true);
    await audit(row.user.id, "admin.password_login");
    return {
      ok: true,
      mfaRequired: row.credential.smsEnabled || row.credential.totpEnabled,
    };
  }
  if (action === "status" && method === "GET") {
    const { auth, credential } = await context();
    return {
      username: credential.username,
      smsEnabled: credential.smsEnabled,
      totpEnabled: credential.totpEnabled,
      totpConfigured: !!credential.totpSecret,
      mfaRequired: !isMfaCurrent(auth.mfaVerifiedAt),
      role: auth.user.role,
    };
  }
  if (action === "sms" && method === "POST") {
    const ctx = await context();
    if (!ctx.credential.smsEnabled) throw new AppError(403, "METHOD_DISABLED");
    await issueSms(ctx);
    return { ok: true };
  }
  if (action === "verify" && method === "POST") {
    const ctx = await context();
    const data = z
      .object({ method: z.enum(["sms", "totp"]), code: codeSchema })
      .parse(input);
    await rateLimit(`admin-mfa:${ctx.auth.user.id}`, 10, 300);
    if (data.method === "sms") {
      if (!ctx.credential.smsEnabled)
        throw new AppError(403, "METHOD_DISABLED");
      await consumeSms(ctx.sessionHash, data.code);
    } else {
      if (!ctx.credential.totpEnabled || !ctx.credential.totpSecret)
        throw new AppError(403, "METHOD_DISABLED");
      const counter = totpCounter(
        decryptSecret(ctx.credential.totpSecret, settingsKey()),
        data.code,
      );
      if (counter === null) throw new AppError(400, "INVALID_OTP");
      const used = await db
        .insert(rateLimits)
        .values({
          key: `admin-totp-used:${ctx.auth.user.id}:${counter}`,
          count: 1,
          resetsAt: new Date(Date.now() + 120000),
        })
        .onConflictDoNothing()
        .returning();
      if (!used.length) throw new AppError(400, "INVALID_OTP");
    }
    await db
      .update(sessions)
      .set({ mfaVerifiedAt: new Date() })
      .where(eq(sessions.tokenHash, ctx.sessionHash));
    await audit(ctx.auth.user.id, "admin.mfa_verified");
    return { ok: true };
  }
  await requireUser(true);
  if (action === "totp-setup" && method === "POST") {
    const data = z.object({ currentPassword: passwordSchema }).parse(input);
    const ctx = await confirmPassword(data.currentPassword);
    await rateLimit(`admin-totp-setup:${ctx.auth.user.id}`, 5, 600);
    const secret = newTotpSecret();
    await db
      .update(adminCredentials)
      .set({
        pendingTotpSecret: encryptSecret(secret, settingsKey()),
        updatedAt: new Date(),
      })
      .where(eq(adminCredentials.userId, ctx.auth.user.id));
    return {
      secret,
      uri: `otpauth://totp/DrSobhanSaki:${encodeURIComponent(ctx.credential.username)}?secret=${secret}&issuer=DrSobhanSaki&algorithm=SHA1&digits=6&period=30`,
    };
  }
  if (action === "sms-setup" && method === "POST") {
    const data = z.object({ currentPassword: passwordSchema }).parse(input);
    const ctx = await confirmPassword(data.currentPassword);
    await issueSms(ctx);
    return { ok: true };
  }
  if (action === "policy" && method === "PUT") {
    const data = z
      .object({
        currentPassword: passwordSchema,
        smsEnabled: z.boolean(),
        totpEnabled: z.boolean(),
        smsCode: codeSchema.optional(),
        totpCode: codeSchema.optional(),
      })
      .parse(input);
    const ctx = await confirmPassword(data.currentPassword);
    await rateLimit(`admin-policy:${ctx.auth.user.id}`, 10, 600);
    let secret = ctx.credential.totpSecret;
    if (data.smsEnabled && !ctx.credential.smsEnabled) {
      if (!data.smsCode) throw new AppError(400, "VERIFY_SMS_FIRST");
      await consumeSms(ctx.sessionHash, data.smsCode);
    }
    if (
      data.totpEnabled &&
      (!ctx.credential.totpEnabled || ctx.credential.pendingTotpSecret)
    ) {
      secret = ctx.credential.pendingTotpSecret || secret;
      if (
        !secret ||
        !data.totpCode ||
        totpCounter(decryptSecret(secret, settingsKey()), data.totpCode) ===
          null
      )
        throw new AppError(400, "VERIFY_TOTP_FIRST");
    }
    await db.transaction(async (tx) => {
      await tx
        .update(adminCredentials)
        .set({
          smsEnabled: data.smsEnabled,
          totpEnabled: data.totpEnabled,
          totpSecret: secret,
          pendingTotpSecret: null,
          updatedAt: new Date(),
        })
        .where(eq(adminCredentials.userId, ctx.auth.user.id));
      await tx
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, ctx.auth.user.id),
            ne(sessions.tokenHash, ctx.sessionHash),
          ),
        );
      await tx
        .update(sessions)
        .set({ mfaVerifiedAt: new Date() })
        .where(eq(sessions.tokenHash, ctx.sessionHash));
      await tx
        .insert(auditLogs)
        .values({
          actorId: ctx.auth.user.id,
          action: "admin.login_policy_changed",
          entityType: "admin_security",
          entityId: ctx.auth.user.id,
          metadata: {
            smsEnabled: data.smsEnabled,
            totpEnabled: data.totpEnabled,
          },
        });
    });
    return { ok: true };
  }
  if (action === "password" && method === "PUT") {
    const data = z
      .object({
        currentPassword: passwordSchema,
        newPassword: z.string().min(12).max(128),
      })
      .parse(input);
    const ctx = await confirmPassword(data.currentPassword);
    const { hashPassword } = await import("@/lib/admin-crypto");
    await db.transaction(async (tx) => {
      await tx
        .update(adminCredentials)
        .set({
          passwordHash: await hashPassword(data.newPassword),
          updatedAt: new Date(),
        })
        .where(eq(adminCredentials.userId, ctx.auth.user.id));
      await tx
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, ctx.auth.user.id),
            ne(sessions.tokenHash, ctx.sessionHash),
          ),
        );
    });
    await audit(ctx.auth.user.id, "admin.password_changed");
    return { ok: true };
  }
  if (action === "sms-settings") {
    const user = await requireUser(true);
    if (user.role !== "super_admin") throw new AppError(403, "FORBIDDEN");
    if (method === "GET") {
      const saved = await storedSmsSettings();
      return {
        configured: !!saved,
        username: saved?.username || "",
        otpBodyId: saved?.otpBodyId || "",
        from: saved?.from || "",
        passwordConfigured: !!saved?.password,
      };
    }
    if (method === "PUT") {
      const data = z
        .object({
          currentPassword: passwordSchema,
          username: z.string().trim().min(1).max(128),
          password: z.string().max(256).optional(),
          otpBodyId: z.string().regex(/^\d+$/),
          from: z.string().max(32).default(""),
        })
        .parse(input);
      await confirmPassword(data.currentPassword);
      const previous = await storedSmsSettings();
      const password = data.password || previous?.password;
      if (!password) throw new AppError(400, "SMS_NOT_CONFIGURED");
      await saveSmsSettings({
        username: data.username,
        password,
        otpBodyId: data.otpBodyId,
        from: data.from,
      });
      await audit(user.id, "admin.sms_settings_changed");
      return { ok: true };
    }
    if (method === "POST") {
      await rateLimit(`sms-test:${user.id}`, 3, 600);
      const code = String(randomInt(100000, 1000000));
      await sendSms(user.phone, `آزمون پیامک: ${code}`, code);
      return { ok: true };
    }
  }
  throw new AppError(404, "NOT_FOUND");
}
