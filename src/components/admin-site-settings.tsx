"use client";
import { useState } from "react";
import Image from "next/image";
import { copy, type Locale } from "@/lib/content";
import { imageFields, siteAsset } from "@/lib/site-assets";

type Settings = Array<{ key: string; value: unknown }>;
export type ContentRow = {
  key: string;
  locale: Locale;
  value: Record<string, string>;
  published: boolean;
};
type Save = (path: string, value: unknown, method?: string) => Promise<void>;
const labels: Record<string, string> = {
  name: "نام پزشک",
  profession: "عنوان حرفه‌ای",
  eyebrow: "عنوان کوچک بالای صفحه",
  hero1: "تیتر اصلی، خط اول",
  hero2: "تیتر اصلی، خط دوم",
  heroDesc: "توضیح اصلی",
  online: "دکمه رزرو",
  meet: "دکمه آشنایی",
  secure: "متن حریم خصوصی",
  personal: "متن مراقبت شخصی",
  follow: "پیگیری",
  care: "عنوان مشاوره",
  careDesc: "توضیح مشاوره",
  phone: "مشاوره تلفنی",
  phoneDesc: "توضیح مشاوره تلفنی",
  text: "مشاوره متنی",
  textDesc: "توضیح مشاوره متنی",
  appointment: "عنوان نوبت",
  appointmentDesc: "توضیح نوبت",
  medicalTitle: "عنوان خدمات",
  medicalDesc: "توضیح خدمات",
  philosophy: "عنوان رویکرد، خط اول",
  philosophy2: "عنوان رویکرد، خط دوم",
  philosophyDesc: "توضیح رویکرد",
  doctorTitle: "معرفی پزشک، خط اول",
  doctorTitle2: "معرفی پزشک، خط دوم",
  doctorDesc: "درباره پزشک",
  doctorNote: "تحصیلات و شماره نظام پزشکی",
  footerDesc: "توضیح پایین سایت",
  stock: "متن جایگزین عکس",
  home: "خانه",
  about: "درباره پزشک",
  services: "خدمات",
  articles: "مقالات",
  contact: "تماس",
  login: "ورود",
  book: "رزرو",
  more: "اطلاعات بیشتر",
  medicalEyebrow: "برچسب خدمات",
  allServices: "دکمه همه خدمات",
  doctorLabel: "برچسب معرفی پزشک",
  doctorButton: "دکمه درباره پزشک",
  infoPending: "متن اطلاعات تماس",
  journalEmpty: "عنوان نبود مقاله",
  journalEmptyDesc: "توضیح نبود مقاله",
  journalDesc: "توضیح مجله",
};
Object.assign(labels, {
  processLabel: "برچسب مراحل رزرو",
  processTitle: "عنوان مراحل رزرو",
  processDesc: "توضیح مراحل رزرو",
  step1: "عنوان مرحله اول",
  step1Desc: "توضیح مرحله اول",
  step2: "عنوان مرحله دوم",
  step2Desc: "توضیح مرحله دوم",
  step3: "عنوان مرحله سوم",
  step3Desc: "توضیح مرحله سوم",
  journal: "مجله سلامت",
  journalTitle: "عنوان مجله",
  faq: "پرسش‌های متداول",
  faqTitle: "عنوان پرسش‌ها",
  faqDesc: "توضیح پرسش‌ها",
  cta: "دعوت به رزرو، خط اول",
  cta2: "دعوت به رزرو، خط دوم",
  ctaDesc: "توضیح دعوت به رزرو",
  quick: "عنوان دسترسی سریع",
  connection: "عنوان ارتباط",
  privacy: "لینک حریم خصوصی",
  terms: "لینک شرایط",
  rights: "متن حقوق سایت",
  urgent: "پیام اورژانسی",
  availability: "عنوان برنامه مشاوره",
  availabilityDesc: "توضیح برنامه مشاوره",
  patient: "عنوان پنل بیمار",
});
export function AdminSiteSettings({
  tab,
  locale,
  settings,
  content,
  busy,
  save,
}: {
  tab: string;
  locale: Locale;
  settings: Settings;
  content: ContentRow[];
  busy: boolean;
  save: Save;
}) {
  const fa = locale === "fa";
  const key = tab === "settings" ? "booking" : tab;
  const initial = (settings.find((s) => s.key === key)?.value || {}) as Record<
    string,
    unknown
  >;
  const [value, setValue] = useState<Record<string, unknown>>({
    ...(tab === "settings"
      ? { enabled: false, patientScheduling: false, doctorScheduling: false }
      : tab === "branding"
        ? { primaryColor: "#0866ff" }
        : {}),
    ...initial,
  });
  const [language, setLanguage] = useState<Locale>(locale);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<
    Record<Locale, { value: Record<string, string>; published: boolean }>
  >(() => {
    const get = (l: Locale) => {
      const row = content.find((c) => c.key === "homepage" && c.locale === l);
      return {
        value: { ...copy[l], ...row?.value },
        published: row?.published || false,
      };
    };
    return { fa: get("fa"), en: get("en") };
  });
  function field(
    name: string,
    label: string,
    type = "text",
    container = value,
  ) {
    return (
      <div className="field" key={name}>
        <label htmlFor={`setting-${name}`}>{label}</label>
        <input
          id={`setting-${name}`}
          type={type}
          value={String(container[name] ?? "")}
          onChange={(e) => setValue((v) => ({ ...v, [name]: e.target.value }))}
        />
      </div>
    );
  }
  function bilingual(name: string, label: string) {
    const group = (value[name] || {}) as Record<string, string>;
    return (
      <fieldset key={name}>
        <legend>{label}</legend>
        {(["fa", "en"] as const).map((l) => (
          <div className="field" key={l}>
            <label htmlFor={`${name}-${l}`}>
              {l === "fa" ? "فارسی" : "English"}
            </label>
            <textarea
              id={`${name}-${l}`}
              dir={l === "fa" ? "rtl" : "ltr"}
              maxLength={name === "title" ? 200 : 1000}
              value={group[l] || ""}
              onChange={(e) =>
                setValue((v) => ({
                  ...v,
                  [name]: { ...group, [l]: e.target.value },
                }))
              }
            />
          </div>
        ))}
      </fieldset>
    );
  }
  async function upload(name: string, file?: File) {
    if (!file) return;
    setError("");
    if (file.size > 4 * 1024 * 1024) {
      setError(
        fa ? "حداکثر حجم عکس ۴ مگابایت است." : "Maximum image size is 4 MB.",
      );
      return;
    }
    setUploading(name);
    try {
      const response = await fetch("/api/admin/site-images", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setValue((v) => ({ ...v, [name]: result.url }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading("");
    }
  }
  async function resetImage(name: string) {
    const current = String(value[name] || "");
    const match = current.match(
      /^\/api\/site-images\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/,
    );
    if (
      match &&
      current !== initial[name] &&
      !Object.entries(value).some(
        ([otherName, otherValue]) =>
          otherName !== name && otherValue === current,
      )
    ) {
      setUploading(name);
      setError("");
      try {
        const response = await fetch(
          `/api/admin/site-images?id=${encodeURIComponent(match[1])}`,
          { method: "DELETE" },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
      } catch (error) {
        setError((error as Error).message);
        return;
      } finally {
        setUploading("");
      }
    }
    setValue((v) => ({ ...v, [name]: "" }));
  }
  return (
    <form
      className="content-panel admin-settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (tab === "content") {
          void save("content", {
            key: "homepage",
            locale: language,
            ...drafts[language],
          });
          return;
        }
        void save("settings", { key, value });
      }}
    >
      {tab === "content" && (
        <>
          <p>
            {fa
              ? "متن‌ها را برای هر زبان ویرایش و ذخیره کنید. با فعال‌کردن انتشار، متن‌ها در سایت نمایش داده می‌شوند."
              : "Edit and save each language. Enable publication to display your changes."}
          </p>
          <div className="field">
            <label htmlFor="content-language">
              {fa ? "زبان محتوا" : "Content language"}
            </label>
            <select
              id="content-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Locale)}
            >
              <option value="fa">فارسی</option>
              <option value="en">English</option>
            </select>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={drafts[language].published}
              onChange={(e) =>
                setDrafts((d) => ({
                  ...d,
                  [language]: { ...d[language], published: e.target.checked },
                }))
              }
            />
            {fa ? "انتشار این زبان روی سایت" : "Publish this language"}
          </label>
          {Object.entries(drafts[language].value).map(([name, text]) => (
            <div className="field" key={`${language}-${name}`}>
              <label htmlFor={`content-${name}`}>
                {labels[name] || name.replace(/([A-Z])/g, " $1")}
              </label>
              <textarea
                id={`content-${name}`}
                dir={language === "fa" ? "rtl" : "ltr"}
                maxLength={10000}
                value={text}
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    [language]: {
                      ...d[language],
                      value: { ...d[language].value, [name]: e.target.value },
                    },
                  }))
                }
              />
            </div>
          ))}
        </>
      )}
      {tab === "branding" && (
        <>
          {field(
            "primaryColor",
            fa ? "رنگ اصلی سایت" : "Primary color",
            "color",
          )}
          <p>
            {fa
              ? "عکس JPG، PNG یا WebP تا ۴ مگابایت انتخاب کنید. سپس ذخیره تغییرات را بزنید. تصاویر این بخش عمومی هستند."
              : "Upload JPG, PNG or WebP up to 4 MB, then save your changes. These images are public."}
          </p>
          <div className="admin-media-grid">
            {imageFields.map(([name, f, e]) => (
              <fieldset key={name}>
                <legend>{fa ? f : e}</legend>
                {siteAsset(value[name]) && (
                  <div className="admin-image-preview">
                    <Image
                      src={siteAsset(value[name])}
                      alt={fa ? f : e}
                      width={360}
                      height={180}
                      unoptimized
                    />
                  </div>
                )}
                <div className="field">
                  <label htmlFor={`upload-${name}`}>
                    {fa ? "انتخاب عکس از دستگاه" : "Choose image"}
                  </label>
                  <input
                    id={`upload-${name}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!!uploading}
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = "";
                      void upload(name, file);
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`image-${name}`}>
                    {fa ? "آدرس تصویر (اختیاری)" : "Image URL (optional)"}
                  </label>
                  <input
                    id={`image-${name}`}
                    dir="ltr"
                    value={String(value[name] || "")}
                    onChange={(e) =>
                      setValue((v) => ({ ...v, [name]: e.target.value }))
                    }
                    pattern="(/[^/].*|https://.*)"
                  />
                </div>
                <button
                  type="button"
                  className="text-link"
                  disabled={!!uploading}
                  onClick={() => void resetImage(name)}
                >
                  {fa ? "بازگشت به تصویر پیش‌فرض" : "Restore default"}
                </button>
                {uploading === name && (
                  <p role="status">{fa ? "در حال آپلود…" : "Uploading…"}</p>
                )}
              </fieldset>
            ))}
          </div>
        </>
      )}
      {tab === "seo" && (
        <>
          {bilingual("title", fa ? "عنوان سایت در جستجو" : "Search title")}
          {bilingual(
            "description",
            fa ? "توضیح سایت در جستجو" : "Search description",
          )}
        </>
      )}
      {tab === "settings" && (
        <>
          <p>
            {fa
              ? "روش‌های رزرو را مشخص کنید. قبل از فعال‌سازی، حساب بانکی، تعرفه و زمان‌های قابل رزرو را تنظیم کنید."
              : "Configure bank accounts, prices and available times before enabling booking."}
          </p>
          {[
            ["enabled", "فعال‌بودن رزرو آنلاین", "Enable online booking"],
            [
              "patientScheduling",
              "انتخاب زمان توسط بیمار",
              "Patient chooses time",
            ],
            ["doctorScheduling", "تعیین زمان توسط پزشک", "Doctor assigns time"],
          ].map(([name, f, e]) => (
            <label className="checkbox" key={name}>
              <input
                type="checkbox"
                checked={!!value[name]}
                onChange={(event) =>
                  setValue((v) => ({ ...v, [name]: event.target.checked }))
                }
              />
              {fa ? f : e}
            </label>
          ))}
        </>
      )}
      {tab === "contact" && (
        <>
          {field("phone", fa ? "شماره تماس" : "Phone", "tel")}
          {field("email", fa ? "ایمیل" : "Email", "email")}
          {bilingual("address", fa ? "نشانی مطب" : "Practice address")}
          {bilingual("hours", fa ? "ساعات پاسخ‌گویی" : "Office hours")}
          <h2>{fa ? "اطلاعات حرفه‌ای پزشک" : "Professional profile"}</h2>
          {bilingual(
            "education",
            fa ? "تحصیلات و سوابق حرفه‌ای" : "Education and experience",
          )}
          {bilingual(
            "registration",
            fa ? "شماره نظام پزشکی" : "Medical registration",
          )}
          {bilingual(
            "interests",
            fa ? "زمینه‌های مشاوره" : "Consultation interests",
          )}
        </>
      )}
      {tab === "policies" && (
        <>
          {bilingual("privacy", fa ? "حریم خصوصی" : "Privacy policy")}
          {bilingual("terms", fa ? "شرایط استفاده" : "Terms of use")}
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button" disabled={busy || !!uploading}>
        {busy
          ? fa
            ? "در حال ذخیره…"
            : "Saving…"
          : fa
            ? "ذخیره تغییرات"
            : "Save changes"}
      </button>
    </form>
  );
}
