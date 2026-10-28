"use client";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/content";
type Policy = {
  username: string;
  smsEnabled: boolean;
  totpEnabled: boolean;
  role: string;
};
export function AdminSecuritySettings({
  locale,
  onlySms = false,
}: {
  locale: Locale;
  onlySms?: boolean;
}) {
  const fa = locale === "fa";
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [sms, setSms] = useState({
    username: "",
    password: "",
    otpBodyId: "",
    from: "",
    passwordConfigured: false,
    patientTestMode: true,
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [enrollment, setEnrollment] = useState<{
    secret: string;
    uri: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await fetch("/api/admin-access/status");
      const policy = await response.json();
      if (!response.ok) throw new Error(policy.message);
      if (!active) return;
      setPolicy(policy);
      if (policy.role === "super_admin") {
        const smsResponse = await fetch("/api/admin-access/sms-settings");
        const saved = await smsResponse.json();
        if (!smsResponse.ok) throw new Error(saved.message);
        if (active) setSms({ ...saved, password: "" });
      }
    })().catch((error) => {
      if (active) setMessage((error as Error).message);
    });
    return () => {
      active = false;
    };
  }, []);
  async function call(action: string, method: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin-access/${action}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setMessage(fa ? "انجام شد." : "Done.");
      if (action === "totp-setup") setEnrollment(data);
      if (action === "password") setNewPassword("");
      if (action === "policy") {
        setEnrollment(null);
        setSmsCode("");
        setTotpCode("");
      }
      if (action === "sms-settings" && method === "PUT")
        setSms((previous) => ({
          ...previous,
          password: "",
          passwordConfigured: true,
        }));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-panel admin-security-panel">
      <h2>
        {onlySms
          ? fa
            ? "اتصال ملی‌پیامک"
            : "MeliPayamak connection"
          : fa
            ? "امنیت و روش‌های ورود مدیر"
            : "Administrator login and security"}
      </h2>
      <div className="field">
        <label htmlFor="security-current-password">
          {fa
            ? "رمز عبور فعلی مدیر برای ذخیرهٔ تغییرات"
            : "Current administrator password to save changes"}
        </label>
        <input
          id="security-current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      {!policy && (
        <p>
          {fa
            ? "برای تغییر تنظیمات، با نام کاربری و رمز مدیر وارد شوید."
            : "Sign in with your administrator password to configure access."}
        </p>
      )}
      {!onlySms && policy && (
        <>
          <p>
            {fa
              ? `حساب: ${policy.username} — هر دو روش قابل خاموش‌کردن هستند؛ اگر هر دو روشن باشند یکی از آن‌ها برای ورود کافی است.`
              : `Account: ${policy.username}. Either enabled second factor can complete sign-in. Both may be disabled.`}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void call("policy", "PUT", {
                currentPassword,
                smsEnabled: policy.smsEnabled,
                totpEnabled: policy.totpEnabled,
                ...(smsCode ? { smsCode } : {}),
                ...(totpCode ? { totpCode } : {}),
              });
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={policy.smsEnabled}
                onChange={(e) =>
                  setPolicy({ ...policy, smsEnabled: e.target.checked })
                }
              />
              {fa
                ? "فعال‌بودن کد پیامکی مدیر"
                : "Enable administrator SMS verification"}
            </label>
            <p>
              <button
                className="button"
                type="button"
                disabled={busy || !currentPassword}
                onClick={() =>
                  void call("sms-setup", "POST", { currentPassword })
                }
              >
                {fa
                  ? "ارسال کد برای فعال‌سازی پیامک"
                  : "Send SMS activation code"}
              </button>
            </p>
            <div className="field">
              <label htmlFor="sms-enable-code">
                {fa ? "کد تأیید پیامکی برای فعال‌سازی" : "SMS activation code"}
              </label>
              <input
                id="sms-enable-code"
                dir="ltr"
                inputMode="numeric"
                maxLength={6}
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
              />
            </div>
            <label>
              <input
                type="checkbox"
                checked={policy.totpEnabled}
                onChange={(e) =>
                  setPolicy({ ...policy, totpEnabled: e.target.checked })
                }
              />
              Google Authenticator
            </label>
            <p>
              <button
                className="button"
                type="button"
                disabled={busy || !currentPassword}
                onClick={() =>
                  void call("totp-setup", "POST", { currentPassword })
                }
              >
                {fa
                  ? "ساخت کلید Google Authenticator"
                  : "Set up Google Authenticator"}
              </button>
            </p>
            {enrollment && (
              <div className="notice">
                <p>
                  {fa
                    ? "در Authenticator گزینهٔ واردکردن کلید راه‌اندازی و حالت زمان‌محور را انتخاب کنید. سپس کد شش‌رقمی را وارد و ذخیره کنید."
                    : "Add this time-based setup key to your authenticator, then enter its six-digit code and save."}
                </p>
                <code dir="ltr" style={{ overflowWrap: "anywhere" }}>
                  {enrollment.secret}
                </code>
                <p>
                  <a href={enrollment.uri}>
                    {fa ? "بازکردن در Authenticator" : "Open in authenticator"}
                  </a>
                </p>
              </div>
            )}
            <div className="field">
              <label htmlFor="totp-enable-code">
                {fa
                  ? "کد Google Authenticator برای فعال‌سازی"
                  : "Authenticator activation code"}
              </label>
              <input
                id="totp-enable-code"
                dir="ltr"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
              />
            </div>
            <button className="button" disabled={busy || !currentPassword}>
              {fa ? "ذخیرهٔ روش‌های ورود" : "Save login methods"}
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void call("password", "PUT", { currentPassword, newPassword });
            }}
          >
            <h3>{fa ? "تغییر رمز عبور" : "Change password"}</h3>
            <div className="field">
              <label htmlFor="security-new-password">
                {fa
                  ? "رمز جدید، حداقل ۱۲ کاراکتر"
                  : "New password, at least 12 characters"}
              </label>
              <input
                id="security-new-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <button className="button" disabled={busy || !currentPassword}>
              {fa ? "تغییر رمز" : "Change password"}
            </button>
          </form>
        </>
      )}
      {policy?.role === "super_admin" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void call("patient-login-mode", "PUT", {
              currentPassword,
              enabled: sms.patientTestMode,
            });
          }}
        >
          <h3>{fa ? "ورود آزمایشی بیماران" : "Patient test sign-in"}</h3>
          <label htmlFor="patient-test-login">
            <input
              id="patient-test-login"
              type="checkbox"
              checked={sms.patientTestMode}
              onChange={(event) =>
                setSms({ ...sms, patientTestMode: event.target.checked })
              }
            />
            {fa
              ? "ورود آزمایشی با کد ثابت 123456 فعال باشد"
              : "Enable test sign-in with code 123456"}
          </label>
          <p className="notice warn">
            {fa
              ? "روشن: هر شمارهٔ بیمار با کد 123456 و بدون پیامک وارد می‌شود. خاموش: فقط کد واقعی پیامک‌شده پذیرفته می‌شود. فقط برای سایت آزمایشی و بدون اطلاعات واقعی استفاده کنید. با تغییر حالت، کدهای قبلی و نشست‌های بیماران باطل می‌شوند؛ ورود مدیر و پزشک شامل این قابلیت نیست."
              : "On: patient numbers use 123456 without SMS. Off: only a real SMS code works. Use only with test data. Changing modes invalidates outstanding codes and patient sessions. Administrator and physician sign-in are excluded."}
          </p>
          <button className="button" disabled={busy || !currentPassword}>
            {fa ? "ذخیرهٔ حالت ورود" : "Save sign-in mode"}
          </button>
        </form>
      )}
      {policy?.role === "super_admin" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void call("sms-settings", "PUT", {
              currentPassword,
              username: sms.username,
              password: sms.password,
              otpBodyId: sms.otpBodyId,
              from: sms.from,
            });
          }}
        >
          <h3>{fa ? "اطلاعات ملی‌پیامک" : "MeliPayamak credentials"}</h3>
          <p>
            {fa
              ? "پس از ذخیره، کد ورود بیماران و مدیر با این تنظیمات ارسال می‌شود. الگوی تأییدشده باید یک متغیر برای کد داشته باشد."
              : "Saved credentials are used immediately for patient and administrator OTP. Use an approved template with one code variable."}
          </p>
          <p className="notice" dir={fa ? "rtl" : "ltr"}>
            {fa
              ? "متن پیشنهادی الگوی ورود: کد ورود شما به سامانه دکتر سبحان ساکی: {0} — این کد را در اختیار دیگران نگذارید. فقط یک متغیر به نام کد ورود دارد؛ شناسهٔ الگوی تأییدشده را پایین وارد کنید."
              : "Suggested OTP pattern: Your Dr. Sobhan Saki sign-in code is {0}. Do not share it. This pattern has just one code variable."}
          </p>
          {(
            [
              [
                "username",
                fa ? "نام کاربری ملی‌پیامک" : "MeliPayamak username",
              ],
              [
                "password",
                fa
                  ? "رمز وب‌سرویس (خالی = حفظ رمز قبلی)"
                  : "API password (blank keeps existing)",
              ],
              [
                "otpBodyId",
                fa ? "شناسه الگوی خدماتی OTP" : "OTP service template ID",
              ],
            ] as const
          ).map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={`meli-${key}`}>{label}</label>
              <input
                id={`meli-${key}`}
                dir="ltr"
                type={key === "password" ? "password" : "text"}
                autoComplete="off"
                required={
                  key === "username" ||
                  key === "otpBodyId" ||
                  (key === "password" && !sms.passwordConfigured)
                }
                value={sms[key]}
                onChange={(e) => setSms({ ...sms, [key]: e.target.value })}
              />
            </div>
          ))}
          {sms.passwordConfigured && (
            <p>
              {fa
                ? "رمز ذخیره شده است و نمایش داده نمی‌شود."
                : "A password is saved and will not be displayed."}
            </p>
          )}
          <button className="button" disabled={busy || !currentPassword}>
            {fa ? "ذخیره و استفاده از ملی‌پیامک" : "Save and use MeliPayamak"}
          </button>{" "}
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => void call("sms-settings", "POST", {})}
          >
            {fa
              ? "ارسال پیامک آزمایشی به شمارهٔ من"
              : "Send a test SMS to my number"}
          </button>
        </form>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
