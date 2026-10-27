"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { copy, type Locale } from "@/lib/content";
import {
  bookingDraftKey,
  bookingDraftSchema,
  type BookingConfig,
} from "@/lib/booking-flow";
import { formatMoney } from "@/lib/domain";
import { formatJalali } from "@/lib/jalali";
import type { PatientAppointment } from "@/lib/patient-portal";
import { LiveBooking } from "./live-booking";
import { ReceiptForm } from "./receipt-form";
import { PatientReceipts } from "./patient-receipts";
import { Icon } from "./icon";
import { patientFetch } from "@/lib/patient-fetch";
type Draft = {
  platform: string;
  mode: string;
  slotId: string;
  idempotencyKey: string;
};
export function BookingForm({
  locale,
  initialType = "phone",
  resume = false,
}: {
  locale: Locale;
  initialType?: string;
  resume?: boolean;
}) {
  const fa = locale === "fa",
    t = copy[locale],
    router = useRouter();
  const [config, setConfig] = useState<BookingConfig | null>(null),
    [authenticated, setAuthenticated] = useState(false);
  const [type, setType] = useState(initialType === "text" ? "text" : "phone"),
    [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null),
    [appointment, setAppointment] = useState<PatientAppointment | null>(null);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [c, s] = await Promise.all([
          patientFetch("/api/config"),
          patientFetch("/api/session"),
        ]);
        const [configuration, session] = await Promise.all([
          c.json(),
          s.json(),
        ]);
        if (!c.ok || !s.ok)
          throw new Error(
            configuration.message ||
              (fa
                ? "دریافت اطلاعات انجام نشد."
                : "Unable to load booking details."),
          );
        if (!active) return;
        setConfig(configuration);
        setAuthenticated(!!session.user);
        setError("");
        if (
          !configuration.types.some((c: { key: string }) => c.key === type) &&
          configuration.types[0]
        )
          setType(configuration.types[0].key);
        if (resume) {
          const saved = bookingDraftSchema.safeParse(
            JSON.parse(
              sessionStorage.getItem(bookingDraftKey(locale)) || "null",
            ),
          );
          if (saved.success && Date.now() - saved.data.savedAt < 86400000) {
            setType(saved.data.type);
            setDraft(saved.data);
            if (session.user) setStep(2);
          }
        }
        const id = new URL(window.location.href).searchParams.get(
          "appointment",
        );
        if (id && !session.user) {
          router.push(
            `/${locale}/login?next=${encodeURIComponent(`/${locale}/booking?appointment=${encodeURIComponent(id)}`)}`,
          );
          return;
        }
        if (id && session.user) {
          const r = await fetch(
            `/api/patient/appointments/${encodeURIComponent(id)}`,
          );
          const data = await r.json();
          if (!r.ok) throw new Error(data.message);
          if (active) {
            setAppointment(data.appointment);
            setType(data.appointment.typeSnapshot.key);
            setStep(3);
            setSuccess(data.appointment.paymentStatus === "under_review");
          }
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof TypeError
              ? fa
                ? "ارتباط با سایت برقرار نشد؛ دوباره تلاش کنید."
                : "Unable to connect. Please retry."
              : (e as Error).message,
          );
      }
    }
    void load();
    return () => {
      active = false;
    };
    // Selection is intentionally restored only when the page is entered or retried.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, resume, attempt]);
  const consultation = config?.types.find((c) => c.key === type);
  function next() {
    const saved = {
      type,
      platform: draft?.platform || "",
      mode: draft?.mode || "",
      slotId: draft?.slotId || "",
      idempotencyKey: draft?.idempotencyKey || crypto.randomUUID(),
      savedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(bookingDraftKey(locale), JSON.stringify(saved));
    } catch {
      setError(
        fa
          ? "ذخیره انتخاب در مرورگر ممکن نیست."
          : "Unable to save booking choices.",
      );
      return;
    }
    setDraft(saved);
    if (authenticated) setStep(2);
    else
      router.push(
        `/${locale}/login?next=${encodeURIComponent(`/${locale}/booking?resume=1`)}`,
      );
  }
  async function backToTime() {
    if (!appointment) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/patient/appointments/${appointment.id}/release`,
        { method: "POST", headers: { "Accept-Language": locale } },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setDraft((previous) => ({
        platform: previous?.platform || "",
        mode: previous?.mode || "patient",
        slotId: previous?.slotId || appointment.slotId || "",
        idempotencyKey: crypto.randomUUID(),
      }));
      setAppointment(null);
      setStep(2);
      window.history.replaceState(null, "", `/${locale}/booking?resume=1`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ol
        className="booking-progress wizard-progress"
        aria-label={fa ? "مراحل دریافت نوبت" : "Booking progress"}
      >
        {(fa
          ? ["انتخاب نوع مشاوره", "انتخاب زمان نوبت", "پرداخت و ارسال رسید"]
          : ["Consultation type", "Appointment time", "Payment & receipt"]
        ).map((label, i) => (
          <li
            key={label}
            className={step === i + 1 ? "current" : step > i + 1 ? "done" : ""}
            aria-current={step === i + 1 ? "step" : undefined}
          >
            <span>
              <b>
                {step > i + 1
                  ? "✓"
                  : new Intl.NumberFormat(locale).format(i + 1)}
              </b>
              {label}
            </span>
          </li>
        ))}
      </ol>
      <div className="form-layout">
        <section className="form-panel" aria-live="polite">
          {error && (
            <div className="form-error" role="alert">
              {error}
              <button
                className="text-link"
                onClick={() => setAttempt((a) => a + 1)}
              >
                {fa ? "تلاش مجدد" : "Retry"}
              </button>
            </div>
          )}
          {!config && !error ? (
            <div className="portal-skeleton" role="status">
              {fa
                ? "در حال دریافت تعرفه و ظرفیت…"
                : "Loading prices and availability…"}
            </div>
          ) : step === 1 ? (
            <>
              <h2>
                {fa ? "نوع مشاوره را انتخاب کنید" : "Choose your consultation"}
              </h2>
              {config && !config.ready && (
                <p className="notice warn">
                  {fa
                    ? "پذیرش نوبت در حال حاضر فعال نیست. لطفاً بعداً مراجعه کنید."
                    : "Bookings are currently closed. Please check again later."}
                </p>
              )}
              <div className="choice-grid">
                {config?.types.map((c) => (
                  <button
                    key={c.id}
                    className={`choice ${type === c.key ? "selected" : ""}`}
                    type="button"
                    aria-pressed={type === c.key}
                    onClick={() => {
                      if (type !== c.key) setDraft(null);
                      setType(c.key);
                    }}
                  >
                    <Icon
                      name={c.key === "phone" ? "phone" : "message"}
                      size={28}
                    />
                    <div>
                      <strong>{c.key === "phone" ? t.phone : t.text}</strong>
                      <span>{formatMoney(c.priceRial, locale)}</span>
                      <small>
                        {new Intl.NumberFormat(locale).format(
                          c.durationMinutes,
                        )}{" "}
                        {fa ? "دقیقه" : "minutes"}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
              {config && !config.types.length && (
                <p className="notice">
                  {fa
                    ? "در حال حاضر روش مشاوره فعالی وجود ندارد."
                    : "No consultations are currently enabled."}
                </p>
              )}
              <p className="notice">
                {fa
                  ? "تعرفه پیش از ورود نمایش داده می‌شود. پس از ورود، زمان آزاد را انتخاب و رسید پرداخت را ارسال می‌کنید."
                  : "Review the price, sign in, choose an available time and submit your bank receipt."}
              </p>
              <button
                className="button"
                disabled={!consultation || !config?.ready}
                onClick={next}
              >
                {authenticated
                  ? fa
                    ? "ادامه و تعیین زمان"
                    : "Continue to scheduling"
                  : fa
                    ? "ادامه و ورود به حساب"
                    : "Continue to sign in"}
                <Icon name="arrow" size={18} />
              </button>
            </>
          ) : step === 2 ? (
            <>
              <h2>{fa ? "انتخاب زمان نوبت" : "Choose appointment time"}</h2>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  try {
                    const saved = bookingDraftSchema.safeParse(
                      JSON.parse(
                        sessionStorage.getItem(bookingDraftKey(locale)) ||
                          "null",
                      ),
                    );
                    if (saved.success) setDraft(saved.data);
                  } catch {}
                  setStep(1);
                }}
              >
                {fa ? "بازگشت به نوع مشاوره" : "Back to consultation type"}
              </button>
              {config && draft && (
                <LiveBooking
                  locale={locale}
                  type={type}
                  config={config}
                  draft={draft}
                  onCreated={(a) => {
                    setAppointment(a);
                    setStep(3);
                    window.history.replaceState(
                      null,
                      "",
                      `/${locale}/booking?appointment=${a.id}`,
                    );
                  }}
                />
              )}
            </>
          ) : (
            appointment && (
              <>
                <h2>
                  {success
                    ? fa
                      ? "رسید شما برای بررسی ثبت شد"
                      : "Receipt submitted for review"
                    : fa
                      ? "پرداخت و ارسال رسید"
                      : "Payment & receipt"}
                </h2>
                <div
                  className={`appointment-status ${success ? "yellow" : "neutral"}`}
                >
                  {success
                    ? fa
                      ? "در انتظار بررسی پزشک"
                      : "Awaiting physician review"
                    : fa
                      ? "رزرو موقت؛ در انتظار پرداخت"
                      : "Temporary reservation; awaiting payment"}
                </div>
                <div className="summary-line">
                  <span>{fa ? "کد پیگیری" : "Tracking code"}</span>
                  <strong dir="ltr">{appointment.trackingCode}</strong>
                </div>
                <div className="summary-line">
                  <span>{fa ? "زمان نوبت (تهران)" : "Time (Tehran)"}</span>
                  <strong>
                    {appointment.startsAt
                      ? formatJalali(appointment.startsAt, true)
                      : fa
                        ? "در انتظار تعیین زمان"
                        : "Awaiting scheduling"}
                  </strong>
                </div>
                <div className="summary-line">
                  <span>{fa ? "مدت مشاوره" : "Duration"}</span>
                  <strong>
                    {new Intl.NumberFormat(locale).format(
                      appointment.durationMinutes,
                    )}{" "}
                    {fa ? "دقیقه" : "minutes"}
                  </strong>
                </div>
                <div className="summary-line">
                  <span>{fa ? "مبلغ قابل پرداخت" : "Amount due"}</span>
                  <strong>{formatMoney(appointment.priceRial, locale)}</strong>
                </div>
                {success ? (
                  <>
                    <p className="notice">
                      {fa
                        ? "ارسال رسید به معنی تأیید نوبت نیست. نتیجه بررسی و در صورت نیاز دلیل اصلاح در پنل بیمار نمایش داده می‌شود. اطلاعات ارتباط با پزشک پس از تأیید نوبت فعال خواهد شد."
                        : "Submitting a receipt does not confirm your appointment. Review results and correction reasons appear in your dashboard. Doctor contact details unlock after confirmation."}
                    </p>
                    <Link
                      className="button"
                      href={`/${locale}/dashboard?appointment=${appointment.id}`}
                    >
                      {fa ? "مشاهده نوبت در پنل بیمار" : "View appointment"}
                    </Link>
                  </>
                ) : [
                    "awaiting_payment",
                    "rejected",
                    "additional_information_required",
                  ].includes(appointment.paymentStatus) &&
                  !["expired", "cancelled"].includes(appointment.status) ? (
                  <>
                    <p className="notice">
                      {fa
                        ? `رزرو تا ${formatJalali(appointment.expiresAt, true)} نگه داشته می‌شود. وجه را فقط به حساب‌های زیر واریز کنید.`
                        : `Reservation expires at ${formatJalali(appointment.expiresAt, true)}. Transfer only to an account below.`}
                    </p>
                    <ReceiptForm
                      appointmentId={appointment.id}
                      locale={locale}
                      onSubmitted={() => {
                        setSuccess(true);
                        sessionStorage.removeItem(bookingDraftKey(locale));
                      }}
                    />
                    <PatientReceipts
                      appointmentId={appointment.id}
                      locale={locale}
                      refreshKey={appointment.paymentStatus}
                      onFinalized={() => setSuccess(true)}
                    />
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => void backToTime()}
                    >
                      {fa
                        ? "بازگشت به انتخاب زمان (پیش از پرداخت)"
                        : "Back to time selection (before payment)"}
                    </button>
                  </>
                ) : (
                  <Link
                    className="button"
                    href={`/${locale}/dashboard?appointment=${appointment.id}`}
                  >
                    {fa ? "ادامه در پنل بیمار" : "Continue in dashboard"}
                  </Link>
                )}
              </>
            )
          )}
        </section>
        <aside className="booking-sidebar">
          <strong>{t.name}</strong>
          <p>{t.profession}</p>
          <h3>{fa ? "خلاصه مشاوره" : "Consultation summary"}</h3>
          <div className="summary-line">
            <span>{fa ? "نوع مشاوره" : "Type"}</span>
            <strong>{type === "phone" ? t.phone : t.text}</strong>
          </div>
          <div className="summary-line">
            <span>{fa ? "تعرفه" : "Price"}</span>
            <strong>
              {appointment
                ? formatMoney(appointment.priceRial, locale)
                : consultation
                  ? formatMoney(consultation.priceRial, locale)
                  : "…"}
            </strong>
          </div>
          <p className="notice">
            {fa
              ? "تأیید نوبت پس از بررسی واریز توسط پزشک انجام می‌شود."
              : "Appointments are confirmed after the physician verifies the bank transfer."}
          </p>
          <p>{t.urgent}</p>
        </aside>
      </div>
    </>
  );
}
