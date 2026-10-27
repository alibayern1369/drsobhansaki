import test from "node:test";
import assert from "node:assert/strict";
import {
  appointmentTone,
  consultationContactAllowed,
} from "../src/lib/patient-portal";
import { appointmentConfirmationMessage } from "../src/lib/notification-message";
test("receipt review is yellow, corrections red and confirmed appointments green", () => {
  assert.equal(
    appointmentTone({
      status: "awaiting_verification",
      paymentStatus: "under_review",
    }),
    "yellow",
  );
  assert.equal(
    appointmentTone({
      status: "awaiting_verification",
      paymentStatus: "rejected",
    }),
    "red",
  );
  assert.equal(
    appointmentTone({
      status: "awaiting_verification",
      paymentStatus: "additional_information_required",
    }),
    "red",
  );
  assert.equal(
    appointmentTone({ status: "confirmed", paymentStatus: "approved" }),
    "green",
  );
  assert.equal(
    appointmentTone({ status: "cancelled", paymentStatus: "approved" }),
    "neutral",
  );
});
test("private contacts require approved payment and a confirmed consultation lifecycle", () => {
  for (const status of [
    "awaiting_payment",
    "awaiting_verification",
    "awaiting_scheduling",
    "cancelled",
    "expired",
    "rejected",
  ])
    assert.equal(
      consultationContactAllowed({ status, paymentStatus: "approved" }),
      false,
    );
  for (const status of ["confirmed", "in_progress", "completed"])
    assert.equal(
      consultationContactAllowed({ status, paymentStatus: "approved" }),
      true,
    );
  assert.equal(
    consultationContactAllowed({
      status: "confirmed",
      paymentStatus: "under_review",
    }),
    false,
  );
});
test("confirmation SMS contains real appointment details in the Iranian calendar", () => {
  const message = appointmentConfirmationMessage({
    startsAt: "2027-03-21T08:30:00Z",
    type: "phone",
    trackingCode: "ABC123",
    siteUrl: "https://drsobhansaki.ir",
  });
  assert.match(message, /دکتر سبحان ساکی/);
  assert.match(message, /مشاوره تلفنی/);
  assert.match(message, /فروردین/);
  assert.match(message, /تهران/);
  assert.match(message, /ABC123/);
  assert.match(message, /https:\/\/drsobhansaki.ir\/fa\/dashboard/);
});
test("saved confirmation text is rendered without omitting required appointment details", () => {
  const input = {
    startsAt: "2027-03-21T08:30:00Z",
    type: "text",
    trackingCode: "T123",
    siteUrl: "https://drsobhansaki.ir",
  };
  const text = appointmentConfirmationMessage(
    input,
    "پیام اختصاصی شما؛ {doctor}، {tracking}",
  );
  assert.match(text, /پیام اختصاصی شما/);
  assert.match(text, /دکتر سبحان ساکی/);
  assert.match(text, /T123/);
  assert.match(text, /مشاوره متنی/);
  assert.match(text, /فروردین/);
  assert.match(text, /\/fa\/dashboard/);
  assert.doesNotMatch(text, /\{doctor\}/);
});
