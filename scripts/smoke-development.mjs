import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { Pool } from "pg";
process.loadEnvFile(".env.local");
assert.equal(
  process.env.NEON_BRANCH,
  "development",
  "Development branch required",
);
assert.equal(
  process.env.SMS_PROVIDER,
  "development",
  "No-delivery SMS adapter required",
);
assert.match(process.env.DEV_OTP_CODE || "", /^\d{6}$/);
const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
assert.equal(
  new URL(base).hostname,
  "localhost",
  "Run this smoke test against a local development server",
);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
const phone = `09000${String(randomInt(0, 1000000)).padStart(6, "0")}`;
const found = await pool.query("select id from users where phone=$1", [phone]);
assert.equal(
  found.rowCount,
  0,
  "Synthetic test number must not already belong to a user",
);
let userCreated = false;
async function request(path, body, cookie) {
  return fetch(`${base}/api/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "en",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
}
try {
  const page = await fetch(`${base}/fa`, {
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(page.status, 200);
  console.log("PASS: Persian page renders with a live database.");
  const config = await request("config");
  assert.equal(config.status, 200);
  const settings = await config.json();
  assert.equal(settings.ready, false);
  assert.deepEqual(settings.banks, []);
  console.log(
    "PASS: booking remains closed and no bank details are fabricated.",
  );
  const unauthorized = await request("appointments");
  assert.equal(unauthorized.status, 401);
  console.log("PASS: patient records require authentication.");
  const otp = await request("auth/otp", { phone });
  assert.equal(otp.status, 200, "Development OTP request failed");
  const login = await request("auth/verify", {
    phone,
    code: process.env.DEV_OTP_CODE,
  });
  assert.equal(login.status, 200, "Development OTP verification failed");
  userCreated = true;
  const session = login.headers.get("set-cookie");
  assert.ok(session?.includes("HttpOnly"));
  const cookie = session.split(";")[0];
  const patient = await request("appointments", undefined, cookie);
  assert.equal(patient.status, 200);
  assert.deepEqual(await patient.json(), []);
  console.log(
    "PASS: development OTP creates an HttpOnly session and opens only the patient account.",
  );
  const admin = await request("admin/overview", undefined, cookie);
  assert.equal(admin.status, 403);
  console.log("PASS: patient cannot access administration.");
  const replay = await request("auth/verify", {
    phone,
    code: process.env.DEV_OTP_CODE,
  });
  assert.equal(replay.status, 400);
  console.log("PASS: consumed OTP cannot be replayed.");
  const csrf = await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://invalid.example", Cookie: cookie },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(csrf.status, 403);
  console.log("PASS: cross-origin state changes are rejected.");
  const logout = await request("auth/logout", {}, cookie);
  assert.equal(logout.status, 200);
  const expired = await request("appointments", undefined, cookie);
  assert.equal(expired.status, 401);
  console.log("PASS: logout invalidates the database session.");
} finally {
  await pool.query("delete from otp_challenges where phone=$1", [phone]);
  await pool.query("delete from rate_limits where key=$1", [
    `otp:phone:${phone}`,
  ]);
  if (userCreated)
    await pool.query("delete from users where phone=$1 and role=$2", [
      phone,
      "patient",
    ]);
  await pool.end();
  console.log(
    "Synthetic development authentication records cleaned up; no real SMS was sent.",
  );
}
