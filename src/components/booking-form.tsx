"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { copy, type Locale } from "@/lib/content";
import { formatMoney } from "@/lib/domain";
import {
  bookingDraftKey,
  bookingDraftSchema,
  type BookingConfig,
} from "@/lib/booking-flow";
import { Icon } from "./icon";
import { LiveBooking } from "./live-booking";
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
  const [type, setType] = useState(initialType === "text" ? "text" : "phone");
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{
    platform: string;
    mode: string;
    slotId: string;
    idempotencyKey: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/config"), fetch("/api/session")])
      .then(async ([c, s]) => {
        if (!c.ok || !s.ok)
          throw new Error(
            fa
              ? "دریافت اطلاعات رزرو انجام نشد."
              : "Unable to load booking details.",
          );
        const [configuration, session] = await Promise.all([
          c.json(),
          s.json(),
        ]);
        if (!active) return;
        setConfig(configuration);
        setAuthenticated(!!session.user);
        if (resume) {
          try {
            const saved = bookingDraftSchema.safeParse(
              JSON.parse(
                sessionStorage.getItem(bookingDraftKey(locale)) || "null",
              ),
            );
            if (saved.success && Date.now() - saved.data.savedAt < 86400000) {
              setType(saved.data.type);
              setDraft(saved.data);
              if (session.user) setStep(3);
            }
          } catch {
            setError(
              fa
                ? "انتخاب قبلی قابل بازیابی نبود؛ دوباره انتخاب کنید."
                : "Please choose your consultation again.",
            );
          }
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [locale, resume, fa]);
  const consultation = config?.types.find((c) => c.key === type);
  function next() {
    const saved = {
      type: type as "phone" | "text",
      platform: "",
      mode: "",
      slotId: "",
      idempotencyKey: crypto.randomUUID(),
      savedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(bookingDraftKey(locale), JSON.stringify(saved));
    } catch {
      setError(
        fa
          ? "برای ادامه دسترسی ذخیره‌سازی مرورگر را فعال کنید."
          : "Enable browser session storage to continue.",
      );
      return;
    }
    setDraft(saved);
    if (authenticated) setStep(3);
    else
      router.push(
        `/${locale}/login?next=${encodeURIComponent(`/${locale}/booking?resume=1`)}`,
      );
  }
  return (
    <>
      <div className="booking-progress">
        {(fa
          ? ["انتخاب مشاوره و تعرفه", "ورود به حساب", "زمان و ثبت نهایی"]
          : ["Consultation & price", "Sign in", "Schedule & confirm"]
        ).map((label, i) => (
          <span key={label} className={step === i + 1 ? "current" : ""}>
            <b>{fa ? ["۱", "۲", "۳"][i] : i + 1}</b>
            {label}
          </span>
        ))}
      </div>
      <div className="form-layout">
        <div className="form-panel">
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {step === 1 ? (
            <>
              <h2>
                {fa ? "نوع مشاوره را انتخاب کنید" : "Choose your consultation"}
              </h2>
              <div className="choice-grid">
                {(["phone", "text"] as const).map((key) => {
                  const item = config?.types.find((c) => c.key === key);
                  return (
                    <button
                      type="button"
                      key={key}
                      aria-pressed={type === key}
                      className={`choice ${type === key ? "selected" : ""}`}
                      onClick={() => setType(key)}
                    >
                      <Icon
                        name={key === "phone" ? "phone" : "message"}
                        size={26}
                      />
                      <div>
                        <strong>{key === "phone" ? t.phone : t.text}</strong>
                        <span>
                          {item
                            ? formatMoney(item.priceRial, locale)
                            : config
                              ? fa
                                ? "فعلاً قابل رزرو نیست"
                                : "Currently unavailable"
                              : fa
                                ? "دریافت تعرفه…"
                                : "Loading price…"}
                        </span>
                        {item && (
                          <small>
                            {item.durationMinutes} {fa ? "دقیقه" : "minutes"}
                          </small>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="notice">
                {fa
                  ? "بعد از انتخاب مشاوره وارد حساب می‌شوید؛ انتخاب شما حفظ می‌شود و پس از ورود، زمان و روش ارتباط را تکمیل می‌کنید."
                  : "Sign in after choosing a consultation. Your selection is preserved so you can continue scheduling immediately."}
              </p>
              <button
                className="button"
                disabled={!consultation}
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
          ) : (
            <>
              <h2>
                {fa
                  ? "تکمیل درخواست مشاوره"
                  : "Complete your consultation request"}
              </h2>
              <button className="text-link" onClick={() => setStep(1)}>
                {fa ? "تغییر نوع مشاوره" : "Change consultation"}
              </button>
              {config && draft && (
                <LiveBooking
                  locale={locale}
                  type={type}
                  config={config}
                  draft={draft}
                />
              )}
            </>
          )}
        </div>
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
              {consultation ? formatMoney(consultation.priceRial, locale) : "…"}
            </strong>
          </div>
          <p className="notice">
            {fa
              ? "نوبت پس از تأیید مستقل واریز و تعیین زمان قطعی می‌شود."
              : "Confirmation requires verified payment and an assigned time."}
          </p>
          {config?.testMode && (
            <p className="notice warn">
              {fa
                ? "حساب آزمایشی: این مسیر روی نوبت‌ها و پرداخت‌های واقعی اثر ندارد. وجهی واریز نکنید."
                : "Test account: isolated bookings and simulated payments. Do not transfer money."}
            </p>
          )}
          <p>{t.urgent}</p>
        </aside>
      </div>
    </>
  );
}
