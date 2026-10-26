"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/content";
export function AdminLogin({ locale }: { locale: Locale }) {
  const router = useRouter();
  const fa = locale === "fa";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="login-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch("/api/admin-access/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept-Language": locale,
            },
            body: JSON.stringify({ username, password }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          router.replace(`/${locale}/admin`);
          router.refresh();
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1>{fa ? "ورود مدیر" : "Administrator sign in"}</h1>
      <div className="field">
        <label htmlFor="admin-username">{fa ? "نام کاربری" : "Username"}</label>
        <input
          id="admin-username"
          autoComplete="username"
          dir="ltr"
          maxLength={64}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="admin-password">{fa ? "رمز عبور" : "Password"}</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          maxLength={128}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button className="button" disabled={busy}>
        {fa ? "ورود به مدیریت" : "Sign in"}
      </button>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <p>
        <a href={`/${locale}/login`}>
          {fa ? "ورود بیماران با شماره همراه" : "Patient phone sign in"}
        </a>
      </p>
    </form>
  );
}
export function AdminChallenge({ locale }: { locale: Locale }) {
  const fa = locale === "fa";
  const [methods, setMethods] = useState<{
    smsEnabled: boolean;
    totpEnabled: boolean;
  } | null>(null);
  const [method, setMethod] = useState("totp");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/admin-access/status").then(async (response) => {
      const data = await response.json();
      if (response.ok) {
        setMethods(data);
        setMethod(data.totpEnabled ? "totp" : "sms");
      } else setMessage(data.message);
    });
  }, []);
  async function call(action: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin-access/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (action === "verify") window.location.reload();
      else setMessage(fa ? "کد پیامکی ارسال شد." : "SMS code sent.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="login-panel"
      onSubmit={(e) => {
        e.preventDefault();
        void call("verify", { method, code });
      }}
    >
      <h1>{fa ? "تأیید دومرحله‌ای مدیر" : "Administrator verification"}</h1>
      <p>
        {fa
          ? "یکی از روش‌های فعال حساب را انتخاب کنید."
          : "Choose an enabled verification method."}
      </p>
      <div className="field">
        <label htmlFor="admin-method">{fa ? "روش تأیید" : "Method"}</label>
        <select
          id="admin-method"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            setCode("");
            setMessage("");
          }}
        >
          {methods?.totpEnabled && (
            <option value="totp">Google Authenticator</option>
          )}
          {methods?.smsEnabled && (
            <option value="sms">{fa ? "کد پیامکی" : "SMS code"}</option>
          )}
        </select>
      </div>
      {method === "sms" && methods?.smsEnabled && (
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void call("sms", {})}
        >
          {fa ? "ارسال کد پیامکی" : "Send SMS code"}
        </button>
      )}
      <div className="field">
        <label htmlFor="admin-code">
          {fa ? "کد شش‌رقمی" : "Six-digit code"}
        </label>
        <input
          id="admin-code"
          dir="ltr"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <button className="button" disabled={busy || !methods}>
        {fa ? "تأیید و ورود" : "Verify and sign in"}
      </button>
      {message && <p role="status">{message}</p>}
      <button
        type="button"
        className="button"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.reload();
        }}
      >
        {fa ? "خروج" : "Sign out"}
      </button>
    </form>
  );
}
