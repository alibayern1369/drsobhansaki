const labels: Record<string, string> = {
  super_admin: "مدیر کل",
  doctor: "پزشک",
  staff: "کارمند مجاز",
  patient: "بیمار",
  signature_verified_not_malware_scanned:
    "قالب فایل معتبر؛ بررسی واریز لازم است",
  pending: "در انتظار",
  draft: "پیش‌نویس",
  published: "منتشرشده",
  archived: "بایگانی",
  failed: "ناموفق",
  sent: "ارسال‌شده",
  sending: "در حال ارسال",
  delivered: "تحویل‌شده",
  completed: "انجام‌شده",
  cancelled: "لغوشده",
  expired: "منقضی",
  confirmed: "تأییدشده",
  in_progress: "در حال انجام",
  awaiting_payment: "در انتظار پرداخت",
  awaiting_verification: "در انتظار بررسی",
  awaiting_scheduling: "در انتظار تعیین زمان",
  under_review: "در حال بررسی",
  approved: "تأییدشده",
  rejected: "ردشده",
  additional_information_required: "نیازمند اطلاعات بیشتر",
  not_uploaded: "بدون رسید",
  paid: "پرداخت‌شده",
  unpaid: "پرداخت‌نشده",
  resolved: "رسیدگی‌شده",
  reschedule: "تغییر زمان",
  cancel: "لغو نوبت",
  booking_submitted: "ثبت درخواست نوبت",
  receipt_submitted: "ثبت رسید پرداخت",
  payment_approved: "تأیید پرداخت",
  payment_rejected: "رد پرداخت",
  payment_additional_information_required: "درخواست اطلاعات پرداخت",
  appointment_confirmed: "تأیید نوبت",
  appointment_cancelled: "لغو نوبت",
  appointment_reminder: "یادآوری نوبت",
  doctor_booking_submitted: "درخواست جدید برای پزشک",
  doctor_appointment_reminder: "یادآوری پزشک",
  SMS_PATTERN_NOT_CONFIGURED: "شناسهٔ الگوی تأییدشده وارد نشده است",
  SMS_DELIVERY_OUTCOME_UNKNOWN:
    "نتیجهٔ ارسال نامشخص است؛ پیش از تلاش مجدد، ملی‌پیامک را بررسی کنید",
  SMS_DELIVERY_FAILED: "سرویس پیامک ارسال را نپذیرفت",
  IN_APP_ONLY: "فقط اعلان داخل پنل؛ بدون ارسال پیامک",
  APPOINTMENT_NOT_CONFIRMED: "نوبت تأیید نشده یا زمان پیام گذشته است",
  phone: "تلفنی",
  text: "متنی",
  whatsapp: "واتساپ",
  telegram: "تلگرام",
  bale: "بله",
  clean: "بررسی فایل موفق",
  pending_scan: "در انتظار بررسی فایل",
  not_scanned: "بررسی‌نشده",
  skipped: "اجرا نشد",
  success: "موفق",
  running: "در حال اجرا",
  finished: "پایان‌یافته",
};
export function adminLabel(value: unknown, fa = true) {
  const text = String(value ?? "");
  return fa
    ? labels[text] || text.replaceAll("_", " ")
    : text.replaceAll("_", " ");
}
export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
}
