type TestLoginEnv = {
  [key: string]: string | undefined;
  TEST_LOGIN_ENABLED?: string;
  TEST_LOGIN_PHONE?: string;
  TEST_LOGIN_CODE?: string;
  TEST_LOGIN_EXPIRES_AT?: string;
};

// Explicit opt-in, one exact phone, and a maximum 24-hour activation window.
// The code still goes through ordinary hashed, expiring, rate-limited challenges.
export function temporaryLogin(
  phone: string,
  env: TestLoginEnv,
  now = Date.now(),
) {
  const expiresAt = Date.parse(env.TEST_LOGIN_EXPIRES_AT || "");
  if (
    env.TEST_LOGIN_ENABLED !== "true" ||
    !/^09\d{9}$/.test(env.TEST_LOGIN_PHONE || "") ||
    phone !== env.TEST_LOGIN_PHONE ||
    !/^\d{6}$/.test(env.TEST_LOGIN_CODE || "") ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + 24 * 3600000
  )
    return null;
  return { code: env.TEST_LOGIN_CODE!, expiresAt };
}
