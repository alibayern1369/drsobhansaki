"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/content";
import { bookingDraftKey, type BookingConfig } from "@/lib/booking-flow";
import { formatMoney } from "@/lib/domain";
import { formatJalali } from "@/lib/jalali";
import { adminLabel } from "@/lib/admin-labels";
export function LiveBooking({
  locale,
  type,
  config,
  draft,
}: {
  locale: Locale;
  type: string;
  config: BookingConfig;
  draft: {
    platform: string;
    mode: string;
    slotId: string;
    idempotencyKey: string;
  };
}) {
  const fa = locale === "fa",
    router = useRouter();
  const [mode, setMode] = useState(draft.mode);
  const [slotId, setSlotId] = useState(draft.slotId);
  const [platform, setPlatform] = useState(draft.platform);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const consultation = config.types.find((t) => t.key === type);
  const messenger = config.platforms.find((p) => p.key === platform);
  useEffect(() => {
    sessionStorage.setItem(
      bookingDraftKey(locale),
      JSON.stringify({
        type,
        platform,
        mode,
        slotId,
        idempotencyKey: draft.idempotencyKey,
        savedAt: Date.now(),
      }),
    );
  }, [type, platform, mode, slotId, draft.idempotencyKey, locale]);
  if (
    !config.ready ||
    !consultation ||
    (!config.testMode && consultation.enabled === false)
  )
    return (
      <p className="notice warn">
        {fa
          ? "این روش مشاوره فعلاً برای ثبت نوبت فعال نیست. تعرفه نمایش‌داده‌شده به‌تنهایی به معنی پذیرش درخواست نیست."
          : "This consultation is not currently open for booking."}
      </p>
    );
  return (
    <form
      className="live-booking-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          const r = await fetch("/api/appointments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept-Language": locale,
            },
            body: JSON.stringify({
              consultationTypeId: consultation.id,
              expectedPriceRial: consultation.priceRial,
              platformId: type === "text" ? messenger?.id : undefined,
              schedulingMode: mode,
              slotId: mode === "patient" ? slotId : undefined,
              consent,
              idempotencyKey: draft.idempotencyKey,
            }),
          });
          const d = await r.json();
          if (r.status === 401) {
            router.push(
              `/${locale}/login?next=${encodeURIComponent(`/${locale}/booking?resume=1`)}`,
            );
            return;
          }
          if (!r.ok) throw new Error(d.message || "Request failed");
          sessionStorage.removeItem(bookingDraftKey(locale));
          router.push(
            `/${locale}/dashboard?appointment=${encodeURIComponent(d.id)}`,
          );
          router.refresh();
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="summary-line">
        <span>{fa ? "تعرفه درخواست" : "Consultation price"}</span>
        <strong>{formatMoney(consultation.priceRial, locale)}</strong>
      </div>
      {type === "text" && (
        <div className="field">
          <label htmlFor="booking-platform">
            {fa ? "پیام‌رسان مشاوره" : "Consultation messenger"}
          </label>
          <select
            id="booking-platform"
            required
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="">
              {fa ? "انتخاب پیام‌رسان" : "Choose messenger"}
            </option>
            {config.platforms.map((p) => (
              <option key={p.id} value={p.key}>
                {adminLabel(p.key, fa)}
              </option>
            ))}
          </select>
          {!config.platforms.length && (
            <p className="notice warn">
              {fa
                ? "راه ارتباطی مشاوره متنی هنوز توسط مدیر فعال نشده است. فعلاً مشاوره تلفنی را انتخاب کنید."
                : "No consultation messenger is enabled yet."}
            </p>
          )}
        </div>
      )}
      <div className="field">
        <label htmlFor="confirmed-scheduling">
          {fa ? "روش تعیین زمان" : "Scheduling"}
        </label>
        <select
          id="confirmed-scheduling"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          required
        >
          <option value="">{fa ? "انتخاب کنید" : "Select"}</option>
          {config.booking?.doctorScheduling && (
            <option value="doctor">
              {fa
                ? "هماهنگی زمان پس از تأیید پرداخت"
                : "Coordinate after payment approval"}
            </option>
          )}
          {config.booking?.patientScheduling && (
            <option value="patient">
              {fa ? "انتخاب از زمان‌های آزاد" : "Choose an available time"}
            </option>
          )}
        </select>
      </div>
      {mode === "patient" && (
        <div className="field">
          <label htmlFor="live-slot">
            {fa ? "زمان مشاوره (تهران)" : "Consultation time (Tehran)"}
          </label>
          <select
            id="live-slot"
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            required
          >
            <option value="">{fa ? "انتخاب زمان" : "Choose time"}</option>
            {config.slots
              .filter((s) => s.consultationTypeId === consultation.id)
              .map((s) => (
                <option value={s.id} key={s.id}>
                  {formatJalali(s.startsAt, true)}
                </option>
              ))}
          </select>
          {!config.slots.some(
            (s) => s.consultationTypeId === consultation.id,
          ) && (
            <p className="notice">
              {fa
                ? "زمان آزاد ثبت نشده؛ گزینه هماهنگی پس از پرداخت را انتخاب کنید."
                : "No available time; choose coordination after payment."}
            </p>
          )}
        </div>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          {fa
            ? "تعرفه و شرایط مشاوره و استفاده از پیام‌رسان انتخابی را می‌پذیرم."
            : "I accept the price, terms and selected external messenger."}{" "}
          <Link href={`/${locale}/terms`} target="_blank">
            {fa ? "شرایط استفاده" : "Terms"}
          </Link>{" "}
          ·{" "}
          <Link href={`/${locale}/privacy`} target="_blank">
            {fa ? "حریم خصوصی" : "Privacy"}
          </Link>
        </span>
      </label>
      <p className="notice">
        {fa
          ? "پس از ثبت، اطلاعات پرداخت و بارگذاری رسید را در پنل بیمار می‌بینید. پس از تأیید واریز، دکمه ورود به چت و ارسال مدارک فعال می‌شود."
          : "After submitting, open your dashboard to pay and upload a receipt. Doctor chat becomes available after payment approval."}
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        className="button"
        disabled={busy || (type === "text" && !messenger)}
      >
        {busy
          ? fa
            ? "در حال ثبت…"
            : "Submitting…"
          : fa
            ? "ثبت درخواست و ادامه پرداخت"
            : "Create request & continue to payment"}
      </button>
    </form>
  );
}
