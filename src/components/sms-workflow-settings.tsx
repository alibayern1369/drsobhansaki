"use client";
import { smsWorkflows, type SmsEvent } from "@/lib/sms-workflow";
import { Icon } from "./icon";
import type { Locale } from "@/lib/content";

export function SmsWorkflowSettings({
  templates,
  locale,
  busy,
  save,
}: {
  templates: {
    key: string;
    content: { fa: string; en: string; patternId?: string };
    enabled: boolean;
  }[];
  locale: Locale;
  busy: boolean;
  save: (path: string, value: unknown) => Promise<unknown>;
}) {
  const fa = locale === "fa";
  const labels = {
    patient: "نام و نام خانوادگی بیمار",
    phone: "شماره بیمار",
    date: "زمان نوبت",
    tracking: "کد پیگیری",
  };
  return (
    <section className="sms-workflows">
      <h2>
        <Icon name="message" size={23} />
        {fa ? "پیامک‌های نوبت؛ فقط ۵ رویداد مشخص" : "Appointment SMS workflows"}
      </h2>
      <p className="notice">
        {fa
          ? "کد ورود در تنظیمات اتصال ملی‌پیامک بالاست. برای هر کارت زیر، متن آماده را در ملی‌پیامک ثبت کنید و فقط شناسهٔ الگوی تأییدشده را اینجا وارد کنید. ترتیب متغیرها را تغییر ندهید. پیامک‌های دیگر ارسال نمی‌شوند؛ اعلان‌های داخل پنل باقی می‌مانند."
          : "Configure OTP above. Register each suggested pattern with the provider, then enter its approved ID below. Keep the variable order. Other events remain in-app only."}
      </p>
      <p className="notice warn">
        {fa
          ? "یادآوری نیازمند اجرای هر دقیقهٔ مسیر /api/jobs با CRON_SECRET است. روی Vercel رایگان، زمان‌بند بیرونی لازم است. گیرندگان پزشک، حساب‌های فعال با نقش پزشک یا مدیر کل هستند؛ شمارهٔ آن‌ها را در بخش کاربران بررسی کنید."
          : "Reminders need /api/jobs invoked every minute with CRON_SECRET. Free Vercel needs an external scheduler. Physician messages go to active doctor/super-admin accounts."}
      </p>
      <div className="sms-workflow-grid">
        {(Object.keys(smsWorkflows) as SmsEvent[]).map((key, index) => {
          const workflow = smsWorkflows[key];
          const saved = templates.find((t) => t.key === key);
          const providerText = workflow.text.replace(
            /\{(patient|phone|date|tracking)\}/g,
            (_, variable: string) =>
              `{${workflow.variables.findIndex((v) => v === variable)}}`,
          );
          return (
            <form
              className="content-panel sms-workflow-card"
              key={`${key}-${saved?.content.patternId}-${saved?.enabled}`}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void save("sms", {
                  key,
                  content: {
                    fa: workflow.text,
                    en: workflow.text,
                    patternId: String(data.get("patternId") || ""),
                  },
                  enabled: data.get("enabled") === "on",
                });
              }}
            >
              <div className="sms-workflow-title">
                <span>{index + 1}</span>
                <h3>{fa ? workflow.label : key.replaceAll("_", " ")}</h3>
              </div>
              <small>
                {fa
                  ? `گیرنده: ${workflow.recipient}`
                  : `Recipient: ${key.startsWith("doctor_") ? "Physician" : "Patient"}`}
              </small>
              <p className="sms-pattern-text" dir="rtl">
                {providerText}
              </p>
              <ol className="sms-variable-list">
                {workflow.variables.map((variable, i) => (
                  <li key={variable}>
                    <code dir="ltr">{`{${i}}`}</code>{" "}
                    {fa ? labels[variable] : variable}
                  </li>
                ))}
              </ol>
              <div className="field">
                <label htmlFor={`pattern-${key}`}>
                  {fa
                    ? "شناسهٔ الگوی تأییدشده در ملی‌پیامک"
                    : "Approved pattern ID"}
                </label>
                <input
                  id={`pattern-${key}`}
                  name="patternId"
                  dir="ltr"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={30}
                  defaultValue={saved?.content.patternId || ""}
                  placeholder="123456"
                />
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={saved?.enabled ?? true}
                />
                {fa ? "ارسال این پیامک فعال باشد" : "Enable this message"}
              </label>
              <button className="button button-small" disabled={busy}>
                {fa ? "ذخیرهٔ این پیامک" : "Save workflow"}
              </button>
            </form>
          );
        })}
      </div>
    </section>
  );
}
