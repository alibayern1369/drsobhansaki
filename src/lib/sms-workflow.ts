import { formatJalali } from "./jalali";

export const smsWorkflows = {
  booking_submitted: {
    label: "ثبت درخواست بیمار",
    recipient: "بیمار",
    variables: ["patient", "date", "tracking"],
    text: "{patient} عزیز، درخواست مشاوره شما برای {date} ثبت شد. پس از بررسی رسید، نتیجه اعلام می‌شود. کد پیگیری: {tracking}\nدکتر سبحان ساکی",
  },
  appointment_confirmed: {
    label: "تأیید نوبت بیمار",
    recipient: "بیمار",
    variables: ["patient", "date", "tracking"],
    text: "{patient} عزیز، نوبت شما در {date} تأیید شد. دکتر سبحان ساکی در زمان نوبت با شما تماس می‌گیرد. مدارک را از بخش جزئیات نوبت ارسال کنید. کد پیگیری: {tracking}",
  },
  appointment_reminder: {
    label: "یادآوری بیمار، ۱۵ دقیقه قبل",
    recipient: "بیمار",
    variables: ["patient", "date"],
    text: "{patient} عزیز، مشاوره شما در {date}، حدود ۱۵ دقیقه دیگر آغاز می‌شود. لطفاً در دسترس باشید؛ دکتر سبحان ساکی با شما تماس می‌گیرد.",
  },
  doctor_booking_submitted: {
    label: "درخواست جدید برای پزشک",
    recipient: "پزشک / مدیر کل",
    variables: ["patient", "phone", "date"],
    text: "دکتر ساکی، درخواست مشاوره جدید از {patient} با شماره {phone} برای {date} ثبت شد. لطفاً درخواست و رسید را در پنل بررسی کنید.",
  },
  doctor_appointment_reminder: {
    label: "یادآوری پزشک، ۱۵ دقیقه قبل",
    recipient: "پزشک / مدیر کل",
    variables: ["patient", "phone", "date"],
    text: "دکتر ساکی، نوبت {patient} با شماره {phone} در {date}، حدود ۱۵ دقیقه دیگر آغاز می‌شود. لطفاً در زمان نوبت با بیمار تماس بگیرید.",
  },
} as const;
export type SmsEvent = keyof typeof smsWorkflows;
export function isSmsEvent(event: string): event is SmsEvent {
  return Object.hasOwn(smsWorkflows, event);
}
export function smsVariables(input: {
  name: string | null;
  phone: string;
  startsAt: Date | string | null;
  trackingCode: string;
}) {
  return {
    patient: input.name?.trim() || "بیمار گرامی",
    phone: input.phone,
    date: input.startsAt
      ? `${formatJalali(input.startsAt, true)} (تهران)`
      : "زمانی که با شما هماهنگ خواهد شد",
    tracking: input.trackingCode,
  };
}
export function renderSms(
  event: SmsEvent,
  values: ReturnType<typeof smsVariables>,
  template?: string,
) {
  return (template || smsWorkflows[event].text).replace(
    /\{(patient|phone|date|tracking)\}/g,
    (_, key: keyof typeof values) => values[key],
  );
}

export function reminderIsCurrent(
  input: {
    status: string;
    paymentStatus: string;
    startsAt: Date | string | null;
    slotEpoch: string | null;
    dedupeKey: string;
    userId: string;
  },
  now = Date.now(),
) {
  const time = input.startsAt ? new Date(input.startsAt).getTime() : NaN;
  return (
    input.status === "confirmed" &&
    input.paymentStatus === "approved" &&
    time > now &&
    time <= now + 15 * 60000 &&
    !!input.slotEpoch &&
    input.dedupeKey.endsWith(`:${input.slotEpoch}:${input.userId}`)
  );
}
