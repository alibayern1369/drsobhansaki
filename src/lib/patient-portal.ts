import type { Locale } from "./content";
export type PatientAppointment = {
  id: string;
  trackingCode: string;
  status: string;
  paymentStatus: string;
  priceRial: number;
  durationMinutes: number;
  typeSnapshot: { key: string };
  slotId: string | null;
  startsAt: string | null;
  createdAt: string;
  expiresAt: string;
};
export const statusLabels: Record<string, [string, string]> = {
  awaiting_payment: ["در انتظار پرداخت", "Awaiting payment"],
  awaiting_verification: ["در انتظار بررسی پزشک", "Awaiting physician review"],
  awaiting_scheduling: ["در انتظار تعیین زمان", "Awaiting scheduling"],
  confirmed: ["تأییدشده", "Confirmed"],
  in_progress: ["در حال انجام", "In progress"],
  completed: ["انجام‌شده", "Completed"],
  cancelled: ["لغوشده", "Cancelled"],
  expired: ["منقضی‌شده", "Expired"],
  rejected: ["نیاز به اصلاح", "Correction required"],
  under_review: ["در انتظار بررسی پزشک", "Awaiting physician review"],
  receipt_submitted: ["رسید ارسال‌شده", "Receipt submitted"],
  additional_information_required: [
    "نیاز به اطلاعات بیشتر",
    "More information required",
  ],
  approved: ["پرداخت تأییدشده", "Payment approved"],
  refunded: ["مستردشده", "Refunded"],
};
export const statusLabel = (value: string, locale: Locale) =>
  statusLabels[value]?.[locale === "fa" ? 0 : 1] ||
  (locale === "fa" ? "ثبت‌شده" : "Recorded");
export function appointmentTone(
  a: Pick<PatientAppointment, "status" | "paymentStatus">,
) {
  if (["cancelled", "expired"].includes(a.status)) return "neutral";
  if (["rejected", "additional_information_required"].includes(a.paymentStatus))
    return "red";
  if (["confirmed", "in_progress", "completed"].includes(a.status))
    return "green";
  return "yellow";
}
export function consultationContactAllowed(
  a: Pick<PatientAppointment, "status" | "paymentStatus">,
) {
  return (
    a.paymentStatus === "approved" &&
    ["confirmed", "in_progress", "completed"].includes(a.status)
  );
}
