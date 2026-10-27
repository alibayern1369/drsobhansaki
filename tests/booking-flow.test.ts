import test from "node:test";
import assert from "node:assert/strict";
import {
  patientReturnTo,
  messengerLink,
  bookingDraftSchema,
  patientAppointmentView,
} from "../src/lib/booking-flow";
test("patient appointment summaries never disclose private doctor contacts", () => {
  const original = {
    id: "one",
    priceRial: 5000000,
    platformSnapshot: {
      key: "telegram",
      link: "https://t.me/private_doctor",
      contactNumber: "09123456789",
    },
  };
  assert.deepEqual(patientAppointmentView(original), {
    id: "one",
    priceRial: 5000000,
    platformSnapshot: { key: "telegram" },
  });
  assert.equal(original.platformSnapshot.link, "https://t.me/private_doctor");
});
test("patient login returns only to allowlisted local pages", () => {
  assert.equal(
    patientReturnTo("/fa/booking?resume=1", "fa"),
    "/fa/booking?resume=1",
  );
  for (const url of [
    "https://evil.example",
    "//evil.example",
    "/fa/admin",
    "/en/booking",
    "/fa/booking/../../admin",
    "javascript:alert(1)",
    "/\\evil.example",
  ])
    assert.equal(patientReturnTo(url, "fa"), "/fa/dashboard");
});
test("messenger links accept Iranian digits and reject executable schemes", () => {
  assert.equal(
    messengerLink({ key: "whatsapp", contactNumber: "۰۹۱۲۳۴۵۶۷۸۹" }),
    "https://wa.me/989123456789",
  );
  assert.equal(
    messengerLink({ key: "telegram", username: "@test_doctor" }),
    "https://t.me/test_doctor",
  );
  assert.equal(
    messengerLink({ key: "bale", username: "test_doctor" }),
    "https://ble.ir/test_doctor",
  );
  assert.equal(
    messengerLink({ key: "telegram", link: "javascript:alert(1)" }),
    null,
  );
  assert.equal(
    messengerLink({ key: "telegram", link: "https://name:pass@example.com" }),
    null,
  );
  assert.equal(messengerLink({ key: "whatsapp", contactNumber: "123" }), null);
});
test("booking drafts persist only supported choices, never prices or identity", () => {
  const draft = bookingDraftSchema.parse({
    type: "text",
    idempotencyKey: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    savedAt: Date.now(),
    priceRial: 1,
    userId: "forged",
  });
  assert.equal(draft.type, "text");
  assert.ok(!("priceRial" in draft));
  assert.ok(!("userId" in draft));
  assert.equal(
    bookingDraftSchema.safeParse({ ...draft, type: "video" }).success,
    false,
  );
});
