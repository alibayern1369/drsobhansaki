"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Locale } from "@/lib/content";
import { Icon } from "./icon";
import { Button } from "./ui/button";
export function LoginForm({ locale }: { locale: Locale }) {
  const fa = locale === "fa";
  const router = useRouter();
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
      const res = await fetch(`/api/auth/${sent ? "verify" : "otp"}`, {
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
      if (sent) {
        router.push(`/${locale}/dashboard`);
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
      <form onSubmit={submit}>
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
            onChange={(e) => setPhone(e.target.value)}
            disabled={sent}
          />
        </div>
        {sent && (
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
              onChange={(e) => setCode(e.target.value)}
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
            : sent
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
