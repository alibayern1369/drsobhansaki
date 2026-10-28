import test from "node:test";
import assert from "node:assert/strict";
import {
  PATIENT_TEST_CODE,
  resolvePatientTestMode,
  patientChallengeValue,
  patientTestAccountAllowed,
} from "../src/lib/test-login";
import { formatPhone } from "../src/lib/phone-display";
import {
  isSmsEvent,
  renderSms,
  reminderIsCurrent,
  smsVariables,
  smsWorkflows,
} from "../src/lib/sms-workflow";
import { sendMelipayamak } from "../src/lib/melipayamak";

const now = Date.parse("2026-10-28T10:00:00Z");
test("patient demo login defaults on only before SMS setup and always obeys an explicit toggle", () => {
  assert.equal(PATIENT_TEST_CODE, "123456");
  assert.equal(resolvePatientTestMode(undefined, false), true);
  assert.equal(resolvePatientTestMode(undefined, true), false);
  for (const configured of [true, false]) {
    assert.equal(resolvePatientTestMode({ enabled: false }, configured), false);
    assert.equal(resolvePatientTestMode({ enabled: true }, configured), true);
    for (const malformed of [null, {}, "true", { enabled: "true" }])
      assert.equal(resolvePatientTestMode(malformed, configured), false);
  }
});

test("switching login mode invalidates old test codes even if a real SMS has the same digits", () => {
  assert.notEqual(
    patientChallengeValue("123456", true),
    patientChallengeValue("123456", false),
  );
  assert.notEqual(
    patientChallengeValue("123456", true),
    patientChallengeValue("654321", true),
  );
});

test("shared patient codes never authorize disabled or privileged accounts", () => {
  assert.equal(patientTestAccountAllowed(undefined), true);
  assert.equal(
    patientTestAccountAllowed({ role: "patient", disabled: false }),
    true,
  );
  assert.equal(
    patientTestAccountAllowed({ role: "patient", disabled: true }),
    false,
  );
  for (const role of ["super_admin", "doctor", "staff"])
    assert.equal(patientTestAccountAllowed({ role, disabled: false }), false);
});

test("Iranian phones display in stable groups regardless of input digit script or country prefix", () => {
  for (const phone of [
    "09123456789",
    "۰۹۱۲۳۴۵۶۷۸۹",
    "+989123456789",
    "00989123456789",
  ])
    assert.equal(formatPhone(phone), "0912 345 6789");
  assert.equal(formatPhone(""), "");
  assert.equal(formatPhone("02112345678"), "02112345678");
});

test("only the five requested appointment events can send SMS", () => {
  assert.equal(Object.keys(smsWorkflows).length, 5);
  for (const event of [
    "receipt_submitted",
    "payment_approved",
    "payment_rejected",
    "appointment_cancelled",
    "__proto__",
    "toString",
  ])
    assert.equal(isSmsEvent(event), false);
  const values = smsVariables({
    name: "علی محمدی",
    phone: "09123456789",
    startsAt: "2027-03-21T08:30:00Z",
    trackingCode: "TRACK123",
  });
  for (const [event, workflow] of Object.entries(smsWorkflows)) {
    assert.equal(isSmsEvent(event), true);
    const text = renderSms(event as keyof typeof smsWorkflows, values);
    assert.match(text, /علی محمدی/);
    assert.doesNotMatch(text, /\{\w+\}/);
    assert.match(text, /تهران/);
    if (event.startsWith("doctor_")) assert.match(text, /09123456789/);
    assert.equal(workflow.variables[0], "patient");
  }
});

test("reminders never send early, after start, after cancellation or for a replaced slot", () => {
  const input = {
    status: "confirmed",
    paymentStatus: "approved",
    startsAt: new Date(now + 15 * 60000),
    slotEpoch: "123.000000",
    userId: "patient-1",
    dedupeKey: "reminder:appointment:123.000000:patient-1",
  };
  assert.equal(reminderIsCurrent(input, now), true);
  assert.equal(
    reminderIsCurrent(
      { ...input, startsAt: new Date(now + 15 * 60000 + 1) },
      now,
    ),
    false,
  );
  assert.equal(
    reminderIsCurrent({ ...input, startsAt: new Date(now) }, now),
    false,
  );
  assert.equal(reminderIsCurrent({ ...input, startsAt: null }, now), false);
  assert.equal(
    reminderIsCurrent({ ...input, status: "cancelled" }, now),
    false,
  );
  assert.equal(
    reminderIsCurrent({ ...input, paymentStatus: "under_review" }, now),
    false,
  );
  assert.equal(
    reminderIsCurrent({ ...input, slotEpoch: "456.000000" }, now),
    false,
  );
  assert.equal(
    reminderIsCurrent({ ...input, userId: "other-patient" }, now),
    false,
  );
});

test("patterns send patient variables in approved order without sending the template body", async () => {
  const config = { username: "test", password: "private", otpBodyId: "321" };
  const transport: typeof fetch = async (_url, options) => {
    const body = options?.body as URLSearchParams;
    assert.equal(body.get("bodyId"), "321");
    assert.equal(body.get("text"), "علی محمدی;09123456789;زمان نوبت");
    assert.equal(body.has("from"), false);
    return Response.json({ RetStatus: 1, Value: "1234" });
  };
  await sendMelipayamak(
    "09123456780",
    "unused",
    config,
    "علی محمدی;09123456789;زمان نوبت",
    transport,
    true,
  );
});

test("unknown provider outcomes are marked for manual review instead of automatic retry", async () => {
  const config = { username: "test", password: "private", otpBodyId: "321" };
  await assert.rejects(
    sendMelipayamak(
      "09123456789",
      "",
      config,
      "patient",
      async () => {
        throw new Error("private");
      },
      true,
    ),
    /^Error: SMS_DELIVERY_OUTCOME_UNKNOWN$/,
  );
  await assert.rejects(
    sendMelipayamak(
      "09123456789",
      "",
      config,
      "patient",
      async () => Response.json({ RetStatus: 0, Value: "-1" }),
      true,
    ),
    /^Error: SMS_DELIVERY_FAILED$/,
  );
});
