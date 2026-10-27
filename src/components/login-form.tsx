"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Locale } from "@/lib/content";
import { patientReturnTo } from "@/lib/booking-flow";
import { normalizeDigits } from "@/lib/admin-labels";
import { Icon } from "./icon";
import { Button } from "./ui/button";
export function LoginForm({
  locale,
  returnTo,
}: {
  locale: Locale;
  returnTo?: string;
}) {
  const fa = locale === "fa";
  const router = useRouter();
  const [testLogin, setTestLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const destination = patientReturnTo(returnTo, locale);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/auth/${testLogin ? "test-patient" : sent ? "verify" : "otp"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": locale,
          },
          body: JSON.stringify(
            testLogin
              ? { username, password }
              : {
                  phone: normalizeDigits(phone),
                  code: normalizeDigits(code),
                  locale,
                },
          ),
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.message ||
            (fa ? "امکان ورود فراهم نیست." : "Unable to sign in."),
        );
      if (sent || testLogin) {
        router.push(destination);
        router.refresh();
      } else setSent(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : fa
            ? "خطای ارتباط"
            : "Connection error",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-panel">
      <span className="small-icon">
        <Icon name="shield" size={28} />
      </span>
      <h1>{fa ? "خوش آمدید" : "Welcome back"}</h1>
      <p>
        {fa
          ? "برای ورود یا ساخت حساب، شماره همراه خود را وارد کنید."
          : "Enter your mobile number to sign in or create an account."}
      </p>
      {destination.includes("/booking") && (
        <p className="notice">
          {fa
            ? "مرحله ۲: ورود؛ انتخاب مشاوره شما محفوظ است و بعد از ورود از همان مرحله ادامه می‌دهید."
            : "Step 2: sign in. Your consultation selection is saved."}
        </p>
      )}
      <button
        className="text-link"
        type="button"
        onClick={() => {
          setTestLogin((v) => !v);
          setSent(false);
          setError("");
        }}
      >
        {testLogin
          ? fa
            ? "ورود با شماره همراه"
            : "Mobile OTP sign-in"
          : fa
            ? "ورود آزمایشی با گذرواژه"
            : "Test patient password sign-in"}
      </button>
      <form onSubmit={submit}>
        {testLogin ? (
          <>
            <div className="field">
              <label htmlFor="test-username">
                {fa ? "نام کاربری آزمایشی" : "Test username"}
              </label>
              <input
                id="test-username"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="field">
              <label htmlFor="test-password">
                {fa ? "گذرواژه آزمایشی" : "Test password"}
              </label>
              <input
                id="test-password"
                autoComplete="current-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
              />
            </div>
          </>
        ) : (
          <div className="field">
            <label htmlFor="login-phone">
              {fa ? "شماره همراه" : "Mobile number"}
            </label>
            <input
              id="login-phone"
              dir="ltr"
              type="tel"
              autoComplete="tel"
              pattern="09[0-9]{9}"
              placeholder="09xxxxxxxxx"
              required
              value={phone}
              onChange={(e) => setPhone(normalizeDigits(e.target.value))}
              disabled={sent}
            />
          </div>
        )}
        {!testLogin && sent && (
          <div className="field">
            <label htmlFor="otp-code">
              {fa ? "کد تأیید شش‌رقمی" : "Six-digit verification code"}
            </label>
            <input
              id="otp-code"
              dir="ltr"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(normalizeDigits(e.target.value))}
            />
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <Button disabled={busy} type="submit">
          {busy
            ? fa
              ? "در حال بررسی…"
              : "Please wait…"
            : sent || testLogin
              ? fa
                ? "تأیید و ورود"
                : "Verify & sign in"
              : fa
                ? "دریافت کد تأیید"
                : "Send verification code"}
          <Icon name="arrow" size={18} />
        </Button>
        {sent && (
          <button
            type="button"
            className="text-link"
            style={{ marginTop: 15, background: "none" }}
            onClick={() => {
              setSent(false);
              setCode("");
            }}
          >
            {fa ? "ویرایش شماره همراه" : "Edit mobile number"}
          </button>
        )}
      </form>
      <p style={{ fontSize: 10, marginBottom: 0 }}>
        {fa
          ? "کد ورود را در اختیار دیگران قرار ندهید."
          : "Never share your sign-in code."}
      </p>
    </div>
  );
}
