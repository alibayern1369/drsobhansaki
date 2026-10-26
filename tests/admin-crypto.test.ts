import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptSecret,
  effectiveAdminVerification,
  encryptSecret,
  hashPassword,
  newTotpSecret,
  totpCounter,
  verifyPassword,
} from "../src/lib/admin-crypto";
test("administrator passwords are salted scrypt hashes with constant-time verification", async () => {
  const password = "test-only-password-123";
  const one = await hashPassword(password);
  const two = await hashPassword(password);
  assert.notEqual(one, two);
  assert.equal(one.includes(password), false);
  assert.equal(await verifyPassword(password, one), true);
  assert.equal(await verifyPassword("wrong", one), false);
  assert.equal(await verifyPassword(password, "bad hash"), false);
});
test("stored integration secrets are encrypted and authenticated", () => {
  const key = "test-only-key-".repeat(4);
  const value = '{"password":"not-a-real-secret"}';
  const encrypted = encryptSecret(value, key);
  assert.equal(encrypted.includes("not-a-real-secret"), false);
  assert.equal(decryptSecret(encrypted, key), value);
  assert.throws(() => decryptSecret(encrypted, "different-key-".repeat(4)));
  assert.throws(() => decryptSecret(encrypted.slice(0, -4) + "AAAA", key));
  assert.throws(() => encryptSecret(value, "short"));
});
test("Google Authenticator follows the RFC TOTP vector and rejects invalid codes", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpCounter(secret, "287082", 59000), 1);
  assert.equal(totpCounter(secret, "000000", 59000), null);
  assert.equal(totpCounter(secret, "287082", 180000), null);
  assert.equal(totpCounter(secret, "invalid", 59000), null);
  assert.match(newTotpSecret(), /^[A-Z2-7]{32}$/);
});
test("patient OTP cannot grant administrator access even when both second factors are disabled", () => {
  const noFactors = { smsEnabled: false, totpEnabled: false };
  const now = new Date();
  assert.equal(effectiveAdminVerification(false, noFactors, now), null);
  assert.equal(effectiveAdminVerification(true, noFactors, null, now), now);
  for (const policy of [
    { smsEnabled: true, totpEnabled: false },
    { smsEnabled: false, totpEnabled: true },
    { smsEnabled: true, totpEnabled: true },
  ]) {
    assert.equal(effectiveAdminVerification(true, policy, null), null);
    assert.equal(effectiveAdminVerification(true, policy, now), now);
  }
});
