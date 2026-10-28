"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Locale } from "@/lib/content";
import { patientReturnTo } from "@/lib/booking-flow";
import { normalizeDigits } from "@/lib/admin-labels";
import { Icon } from "./icon";
import { formatPhone } from "@/lib/phone-display";
export function LoginForm({
  locale,
  returnTo,
}: {
  locale: Locale;
  returnTo?: string;
}) {
  const fa = locale === "fa",
    router = useRouter(),
    destination = patientReturnTo(returnTo, locale);
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState("");
  const [profileRequired, setProfileRequired] = useState(false);
  const [fullName, setFullName] = useState("");
  const [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  const [error, setError] = useState(""),
    [remaining, setRemaining] = useState(0);
  const [resendAttempt, setResendAttempt] = useState(0);
  const otpInput = useRef<HTMLInputElement>(null);
  const validPhone = /^09\d{9}$/.test(phone);
  useEffect(() => {
    if (!sent) return;
    const deadline = Date.now() + 60000;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    const timer = setInterval(update, 1000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [sent, resendAttempt]);
  useEffect(() => {
    if (sent) otpInput.current?.focus();
  }, [sent]);
  async function handleSend(verify: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${verify ? "verify" : "otp"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify({ phone, code, locale }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.message ||
            (fa ? "امکان ورود فراهم نیست." : "Unable to sign in."),
        );
      if (verify) {
        if (data.profileRequired) {
          setProfileRequired(true);
          return;
        }
        setSuccess(true);
        window.dispatchEvent(new Event("medical-session-changed"));
        router.push(destination);
        router.refresh();
      } else {
        setSent(true);
        setCode("");
        setRemaining(60);
        setResendAttempt((value) => value + 1);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : fa
            ? "خطای ارتباط؛ دوباره تلاش کنید."
            : "Connection error. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (profileRequired)
    return (
      <div className="login-panel patient-login">
        <h1>{fa ? "آشنایی با شما" : "Your profile"}</h1>
        <p>
          {fa
            ? "برای نمایش نام شما در حساب و پیامک‌های نوبت، نام و نام خانوادگی‌تان را وارد کنید."
            : "Enter your full name for your account and appointment messages."}
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const response = await fetch("/api/patient/profile", {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "Accept-Language": locale,
                },
                body: JSON.stringify({ name: fullName.trim(), locale }),
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(
                  result.message ||
                    (fa ? "ذخیره نام انجام نشد." : "Unable to save name."),
                );
              window.dispatchEvent(new Event("medical-session-changed"));
              router.push(destination);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="field">
            <label htmlFor="login-full-name">
              {fa ? "نام و نام خانوادگی" : "Full name"}
            </label>
            <input
              id="login-full-name"
              autoComplete="name"
              required
              minLength={3}
              maxLength={100}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            className="button"
            disabled={busy || fullName.trim().length < 3}
          >
            {fa ? "ذخیره و ادامه" : "Save and continue"}
          </button>
        </form>
      </div>
    );
  return (
    <div className="login-panel patient-login">
      <div className="login-identity">
        <span className="small-icon">
          <Icon name="shield" size={28} />
        </span>
        <span>
          {fa
            ? "دکتر سبحان ساکی · همراه سلامتی شما"
            : "Dr. Sobhan Saki · Your health companion"}
        </span>
      </div>
      <p className="eyebrow">
        {fa ? "ورود امن به پنل بیمار" : "Secure patient sign-in"}
      </p>
      <h1>
        {success
          ? fa
            ? "با موفقیت وارد شدید"
            : "Signed in successfully"
          : sent
            ? fa
              ? "کد تأیید را وارد کنید"
              : "Enter verification code"
            : fa
              ? "خوش آمدید"
              : "Welcome back"}
      </h1>
      <p>
        {sent ? (
          fa ? (
            <>
              کد ورود مربوط به شمارهٔ <bdi dir="ltr">{formatPhone(phone)}</bdi>{" "}
              را وارد کنید.
            </>
          ) : (
            <>
              Enter the sign-in code for{" "}
              <bdi dir="ltr">{formatPhone(phone)}</bdi>.
            </>
          )
        ) : fa ? (
          "با شماره همراه خود وارد شوید؛ اگر حسابی ندارید، همان لحظه ساخته می‌شود."
        ) : (
          "Sign in with your mobile number. New accounts are created automatically."
        )}
      </p>
      {destination.includes("/booking") && (
        <p className="notice">
          {fa
            ? "انتخاب مشاوره شما محفوظ است؛ پس از ورود، انتخاب زمان نوبت را ادامه می‌دهید."
            : "Your consultation is saved. Continue choosing your time after sign-in."}
        </p>
      )}
      <div
        className="login-stages"
        aria-label={fa ? "مراحل ورود" : "Sign-in stages"}
      >
        <span className={!sent ? "active" : "done"}>
          {fa ? "۱ شماره همراه" : "1 Mobile"}
        </span>
        <span className={sent ? "active" : ""}>
          {fa ? "۲ تأیید هویت" : "2 Verification"}
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend(sent);
        }}
        aria-busy={busy}
      >
        <div className="field">
          <label htmlFor="login-phone">
            {fa ? "شماره همراه" : "Mobile number"}
          </label>
          <input
            id="login-phone"
            dir="ltr"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            pattern="09[0-9]{9}"
            placeholder="09xxxxxxxxx"
            required
            value={phone}
            maxLength={11}
            onChange={(e) =>
              setPhone(normalizeDigits(e.target.value).replace(/\D/g, ""))
            }
            disabled={sent || busy}
            aria-describedby="phone-help"
          />
          <small id="phone-help">
            {fa
              ? "شماره ایران، ۱۱ رقم و با ۰۹؛ ارقام فارسی و انگلیسی پذیرفته می‌شوند."
              : "Iranian mobile: 11 digits starting with 09. Persian digits accepted."}
          </small>
        </div>
        {sent && (
          <div className="field">
            <label htmlFor="otp-code">
              {fa ? "کد تأیید شش‌رقمی" : "Six-digit verification code"}
            </label>
            <input
              ref={otpInput}
              className="otp-input"
              id="otp-code"
              dir="ltr"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(normalizeDigits(e.target.value).replace(/\D/g, ""))
              }
              disabled={busy}
            />
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <p className="form-success" role="status">
            {fa ? "در حال انتقال به حساب شما…" : "Opening your account…"}
          </p>
        )}
        <button
          className="button"
          disabled={
            busy || success || !validPhone || (sent && code.length !== 6)
          }
        >
          {busy
            ? fa
              ? "در حال بررسی…"
              : "Please wait…"
            : sent
              ? fa
                ? "تأیید و ورود"
                : "Verify & sign in"
              : fa
                ? "دریافت کد تأیید"
                : "Send verification code"}
          <Icon name="arrow" size={18} />
        </button>
        {sent && (
          <div className="login-help">
            <button
              className="text-link"
              type="button"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode("");
                setError("");
              }}
            >
              {fa ? "ویرایش شماره همراه" : "Edit mobile number"}
            </button>
            <button
              className="text-link"
              type="button"
              disabled={busy || remaining > 0}
              onClick={() => void handleSend(false)}
            >
              {remaining
                ? `${fa ? "ارسال مجدد تا" : "Resend in"} ${new Intl.NumberFormat(locale).format(remaining)} ${fa ? "ثانیه" : "s"}`
                : fa
                  ? "ارسال مجدد کد"
                  : "Resend code"}
            </button>
          </div>
        )}
      </form>
      <p className="login-security">
        {fa
          ? "کد ورود را در اختیار دیگران نگذارید. اطلاعات حساب شما خصوصی است."
          : "Never share your sign-in code. Your account information is private."}
      </p>
    </div>
  );
}
