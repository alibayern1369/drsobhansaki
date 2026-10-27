"use client";
import type { Locale } from "@/lib/content";
export function ConsultationPhoneSettings({
  locale,
  settings,
  busy,
  save,
}: {
  locale: Locale;
  settings: { key: string; value: unknown }[];
  busy: boolean;
  save: (path: string, value: unknown, method?: string) => Promise<void>;
}) {
  const fa = locale === "fa";
  const value = (settings.find((s) => s.key === "consultationContact")?.value ||
    {}) as { phone?: string; phoneInstructions?: { fa?: string; en?: string } };
  return (
    <form
      className="content-panel"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        void save("settings", {
          key: "consultationContact",
          value: {
            phone: String(data.get("phone") || ""),
            phoneInstructions: {
              fa: String(data.get("fa") || ""),
              en: String(data.get("en") || ""),
            },
          },
        });
      }}
    >
      <h2>
        {fa
          ? "اطلاعات خصوصی مشاوره تلفنی"
          : "Private telephone consultation details"}
      </h2>
      <p className="notice">
        {fa
          ? "این شماره با تلفن فوتر متفاوت است و فقط برای نوبت تأییدشده تلفنی نمایش داده می‌شود. اگر پزشک با بیمار تماس می‌گیرد، شماره را خالی بگذارید و شیوه تماس را توضیح دهید."
          : "Separate from public footer contacts. Visible only after telephone appointment confirmation. Leave the number empty if the physician calls the patient, and explain this below."}
      </p>
      <div className="field">
        <label htmlFor="consultation-phone">
          {fa ? "شماره پزشک (اختیاری)" : "Doctor phone (optional)"}
        </label>
        <input
          id="consultation-phone"
          name="phone"
          type="tel"
          dir="ltr"
          defaultValue={value.phone || ""}
          maxLength={30}
        />
      </div>
      <div className="field">
        <label htmlFor="consultation-instructions-fa">
          {fa ? "راهنمای تماس — فارسی" : "Call instructions — Persian"}
        </label>
        <textarea
          id="consultation-instructions-fa"
          name="fa"
          defaultValue={value.phoneInstructions?.fa || ""}
          maxLength={10000}
        />
      </div>
      <div className="field">
        <label htmlFor="consultation-instructions-en">
          {fa ? "راهنمای تماس — انگلیسی" : "Call instructions — English"}
        </label>
        <textarea
          id="consultation-instructions-en"
          name="en"
          dir="ltr"
          defaultValue={value.phoneInstructions?.en || ""}
          maxLength={10000}
        />
      </div>
      <button className="button button-small" disabled={busy}>
        {fa ? "ذخیره راهنمای تماس" : "Save call details"}
      </button>
    </form>
  );
}
