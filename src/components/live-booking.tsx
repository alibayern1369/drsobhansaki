"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale } from "@/lib/content";
import { formatMoney } from "@/lib/domain";
type Config = {
  ready: boolean;
  booking?: { patientScheduling?: boolean; doctorScheduling?: boolean };
  types: {
    id: string;
    key: string;
    priceRial: number;
    durationMinutes: number;
  }[];
  platforms: { id: string; key: string }[];
  slots: { id: string; consultationTypeId: string; startsAt: string }[];
};
export function LiveBooking({
  locale,
  type,
  platform,
}: {
  locale: Locale;
  type: string;
  platform: string;
}) {
  const fa = locale === "fa";
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [mode, setMode] = useState("");
  const [slotId, setSlotId] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    void Promise.all([
      fetch("/api/config").then((r) => r.json()),
      fetch("/api/session").then((r) => r.json()),
    ])
      .then(([c, s]) => {
        setConfig(c);
        setAuthenticated(!!s.user);
      })
      .catch(() =>
        setMessage(
          fa ? "دریافت تنظیمات انجام نشد." : "Unable to load configuration.",
        ),
      );
  }, [fa]);
  if (!config?.ready)
    return (
      <div className="notice warn" style={{ margin: "23px 0" }}>
        {fa
          ? "رزرو هنوز ثبت نشده است. پذیرش نوبت پس از تأیید تعرفه، برنامهٔ پزشک و فعال‌سازی سامانه آغاز می‌شود. در حال حاضر پرداختی انجام ندهید."
          : "Your appointment has not been submitted. Bookings open after pricing, availability and system setup are confirmed. Please do not transfer payment yet."}
      </div>
    );
  if (!authenticated)
    return (
      <div style={{ margin: "23px 0" }}>
        <p className="notice">
          {fa
            ? "برای ثبت واقعی درخواست ابتدا وارد شوید؛ سپس دوباره اطلاعات رزرو را انتخاب کنید."
            : "Sign in first, then select your consultation again to complete a real booking."}
        </p>
        <Link
          href={`/${locale}/login`}
          className="button"
          style={{ marginTop: 15 }}
        >
          {fa ? "ورود برای ادامه" : "Sign in to continue"}
        </Link>
      </div>
    );
  const consultation = config.types.find((t) => t.key === type);
  const messenger =
    type === "text"
      ? config.platforms.find((p) => p.key === platform)
      : undefined;
  if (!consultation || (type === "text" && !messenger))
    return (
      <p className="notice warn" style={{ margin: "23px 0" }}>
        {fa
          ? "روش مشاوره یا پیام‌رسان انتخابی اکنون فعال نیست. لطفاً انتخاب خود را ویرایش کنید."
          : "Your selected consultation or messaging platform is not enabled. Please edit your selection."}
      </p>
    );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify({
          consultationTypeId: consultation!.id,
          platformId: messenger?.id,
          schedulingMode: mode,
          slotId: mode === "patient" ? slotId : undefined,
          consent,
          idempotencyKey,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      router.push(`/${locale}/dashboard`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} style={{ margin: "23px 0" }}>
      <div className="summary-line">
        <span>
          {fa ? "تعرفه قطعی این درخواست" : "Agreed price for this request"}
        </span>
        <strong>{formatMoney(consultation.priceRial, locale)}</strong>
      </div>
      <div className="summary-line">
        <span>{fa ? "مدت مشاوره" : "Duration"}</span>
        <strong>
          {consultation.durationMinutes} {fa ? "دقیقه" : "minutes"}
        </strong>
      </div>
      <div className="field" style={{ marginTop: 20 }}>
        <label htmlFor="confirmed-scheduling">
          {fa ? "روش قطعی تعیین زمان" : "Scheduling method"}
        </label>
        <select
          id="confirmed-scheduling"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          required
        >
          <option value="">{fa ? "انتخاب کنید" : "Choose a method"}</option>
          {config.booking?.doctorScheduling && (
            <option value="doctor">
              {fa
                ? "تعیین توسط پزشک پس از تأیید واریز"
                : "Doctor assigns after payment verification"}
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
            {fa ? "زمان آزاد (تهران)" : "Available time (Tehran)"}
          </label>
          <select
            id="live-slot"
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            required
          >
            <option value="">{fa ? "انتخاب زمان" : "Select time"}</option>
            {config.slots
              .filter((s) => s.consultationTypeId === consultation.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.startsAt).toLocaleString(fa ? "fa-IR" : "en-US", {
                    timeZone: "Asia/Tehran",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </option>
              ))}
          </select>
        </div>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        {fa
          ? "تعرفه و شرایط را می‌پذیرم و با ثبت درخواست برای حساب احرازشدهٔ خود و استفاده از پیام‌رسان انتخابی موافقم."
          : "I accept this price and terms, and consent to booking for my authenticated account and using the selected messaging platform."}
      </label>
      <button className="button" disabled={busy}>
        {fa
          ? "ثبت درخواست و ادامه پرداخت"
          : "Create request & continue to payment"}
      </button>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
