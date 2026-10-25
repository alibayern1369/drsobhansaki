import test from "node:test";
import assert from "node:assert/strict";
import {
  assertTransition,
  bookingSchema,
  canVerifyPayment,
  formatMoney,
  phoneSchema,
  validateReceipt,
} from "../src/lib/domain";
test("Iranian mobile numbers require correct prefix and length", () => {
  assert.equal(phoneSchema.safeParse("09123456789").success, true);
  for (const v of ["+989123456789", "091234", "abc", "02112345678"])
    assert.equal(phoneSchema.safeParse(v).success, false);
});
test("receipt is not equivalent to approved payment", () => {
  assert.throws(() =>
    assertTransition("payment", "awaiting_payment", "approved"),
  );
  assert.throws(() =>
    assertTransition("payment", "receipt_submitted", "approved"),
  );
  assert.doesNotThrow(() =>
    assertTransition("payment", "under_review", "approved"),
  );
});
test("unverified appointment cannot be confirmed", () => {
  assert.throws(() =>
    assertTransition("appointment", "awaiting_payment", "confirmed"),
  );
  assert.doesNotThrow(() =>
    assertTransition("appointment", "awaiting_scheduling", "confirmed"),
  );
});
test("completed and cancelled appointments are terminal", () => {
  assert.throws(() =>
    assertTransition("appointment", "completed", "confirmed"),
  );
  assert.throws(() =>
    assertTransition("appointment", "cancelled", "confirmed"),
  );
});
test("same state is idempotent", () => {
  assert.doesNotThrow(() =>
    assertTransition("payment", "approved", "approved"),
  );
});
test("staff and patients cannot verify bank payments", () => {
  assert.equal(canVerifyPayment("staff"), false);
  assert.equal(canVerifyPayment("patient"), false);
  assert.equal(canVerifyPayment("doctor"), true);
  assert.equal(canVerifyPayment("super_admin"), true);
});
test("booking requires explicit consent", () => {
  assert.equal(
    bookingSchema.safeParse({
      consultationTypeId: crypto.randomUUID(),
      schedulingMode: "doctor",
      consent: false,
      idempotencyKey: crypto.randomUUID(),
    }).success,
    false,
  );
});
test("patient scheduling requires a selected slot", () => {
  assert.equal(
    bookingSchema.safeParse({
      consultationTypeId: crypto.randomUUID(),
      schedulingMode: "patient",
      consent: true,
      idempotencyKey: crypto.randomUUID(),
    }).success,
    false,
  );
});
test("doctor scheduling accepts no slot", () => {
  assert.equal(
    bookingSchema.safeParse({
      consultationTypeId: crypto.randomUUID(),
      schedulingMode: "doctor",
      consent: true,
      idempotencyKey: crypto.randomUUID(),
    }).success,
    true,
  );
});
test("money rejects floating point and negative values", () => {
  assert.throws(() => formatMoney(1.1, "fa"));
  assert.throws(() => formatMoney(-5, "en"));
  assert.equal(formatMoney(1000000, "en"), "100,000 Toman");
  assert.equal(formatMoney(1000000, "en", "rial"), "1,000,000 IRR");
});
test("receipt checks file signature rather than filename", () => {
  assert.equal(
    validateReceipt(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
    ),
    "image/png",
  );
  assert.throws(() =>
    validateReceipt(
      new Uint8Array([60, 115, 99, 114, 105, 112, 116]),
      "image/png",
    ),
  );
});
test("receipt rejects mismatched MIME and oversized content", () => {
  assert.throws(() =>
    validateReceipt(new Uint8Array([255, 216, 255]), "application/pdf"),
  );
  assert.throws(() =>
    validateReceipt(new Uint8Array(5 * 1024 * 1024 + 1), "image/png"),
  );
  assert.throws(() => validateReceipt(new Uint8Array(), "image/png"));
});
test("only supported receipt types are accepted", () => {
  assert.equal(
    validateReceipt(new TextEncoder().encode("%PDF-1.7"), "application/pdf"),
    "application/pdf",
  );
  assert.equal(
    validateReceipt(new Uint8Array([255, 216, 255, 224]), "image/jpeg"),
    "image/jpeg",
  );
});
