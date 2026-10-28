"use client";
import { ArticleImageField, withArticleCover } from "./article-image-field";
import { formatJalali } from "@/lib/jalali";
import { useEffect, useState } from "react";
import { type Locale } from "@/lib/content";
import { Icon, type IconName } from "./icon";
import { AdminOperations } from "./admin-operations";
import { AdminAppointmentList } from "./admin-appointment-list";
import { AdminChallenge } from "./admin-login";
import { AdminSecuritySettings } from "./admin-security-settings";
import { AdminSiteSettings, type ContentRow } from "./admin-site-settings";
import { ReceiptStorageSettings } from "./receipt-storage-settings";
import { ConsultationFees } from "./consultation-fees";
import { ContactCards } from "./contact-cards";
type AdminData = {
  role: string;
  currentUserId: string;
  stats?: {
    total: number;
    review: number;
    confirmed: number;
    completed: number;
  };
  appointments: Array<{
    id: string;
    trackingCode: string;
    status: string;
    paymentStatus: string;
    priceRial: number;
    consultationTypeId: string;
    patientName: string | null;
    patientPhone: string;
  }>;
  consultations: Array<{
    id: string;
    key: string;
    priceRial: number;
    durationMinutes: number;
    bufferMinutes: number;
    enabled: boolean;
  }>;
  platforms: Array<{
    id: string;
    key: string;
    enabled: boolean;
    link: string | null;
    contactNumber: string | null;
    username: string | null;
  }>;
  content: ContentRow[];
  articles: unknown[];
  audit: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
  }>;
  settings: Array<{ key: string; value: unknown }>;
};
export function AdminPanel({
  locale,
  mfaRequired,
  passwordLogin = false,
}: {
  locale: Locale;
  mfaRequired: boolean;
  passwordLogin?: boolean;
}) {
  const fa = locale === "fa";
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState<AdminData | null>(null);
  const [mfa, setMfa] = useState(mfaRequired);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch("/api/admin/overview", {
      headers: { "Accept-Language": locale },
    });
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.message);
      return;
    }
    setData(d);
  }
  useEffect(() => {
    if (!mfaRequired)
      void fetch("/api/admin/overview", {
        headers: { "Accept-Language": locale },
      })
        .then(async (r) => {
          const d = await r.json();
          if (r.ok) {
            setData(d);
            const requested = window.location.hash.slice(1);
            if (
              [
                "overview",
                "appointments",
                "patients",
                "appointment-requests",
                "consultations",
                "banks",
                "calendar",
                "platforms",
                "social",
                "sms",
                "articles",
                "content",
                "branding",
                "contact",
                "policies",
                "seo",
                "roles",
                "audit",
                "settings",
                "receipt-storage",
                "security-login",
              ].includes(requested)
            )
              setTab(requested);
          } else {
            setMessage(d.message);
            if (d.code === "ADMIN_MFA_REQUIRED") setMfa(true);
          }
        })
        .catch(() =>
          setMessage(
            fa
              ? "ارتباط با سرور برقرار نشد. صفحه را دوباره بارگذاری کنید."
              : "Connection failed. Reload this page.",
          ),
        );
  }, [mfaRequired, locale, fa]);
  async function save(path: string, value: unknown, method = "PUT") {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`/api/admin/${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify(value),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setMessage(fa ? "ذخیره شد." : "Saved.");
      await load();
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const tabs: [string, string, string, IconName][] = [
    ["security-login", "امنیت و ورود", "Login security", "lock"],
    ["overview", "نمای کلی", "Overview", "dashboard"],
    [
      "appointments",
      "نوبت‌ها و پرداخت‌ها",
      "Appointments & payments",
      "calendar",
    ],
    ["patients", "بیماران", "Patients", "user"],
    [
      "appointment-requests",
      "درخواست‌های بیماران",
      "Patient requests",
      "message",
    ],
    ["consultations", "خدمات و تعرفه‌ها", "Consultations & pricing", "doctor"],
    ["banks", "حساب‌های بانکی", "Bank accounts", "copy"],
    ["calendar", "تقویم", "Calendar", "calendar"],
    [
      "platforms",
      "راه‌های ارتباطی مشاوره",
      "Consultation messengers",
      "message",
    ],
    ["social", "شبکه‌های اجتماعی فوتر", "Footer social links", "send"],
    ["sms", "مدیریت پیامک", "SMS management", "phone"],
    ["articles", "مقالات پزشکی", "Medical articles", "file"],
    ["content", "محتوای سایت", "Website content", "file"],
    ["branding", "تصاویر و هویت بصری", "Images & branding", "settings"],
    ["contact", "اطلاعات تماس", "Contact details", "phone"],
    ["policies", "حریم خصوصی و شرایط", "Privacy & terms", "shield"],
    ["seo", "تنظیمات SEO", "SEO settings", "globe"],
    ["roles", "مدیران و کارکنان", "Administrators & staff", "shield"],
    ["audit", "گزارش امنیتی", "Security logs", "lock"],
    ["settings", "تنظیمات سامانه", "System settings", "settings"],
    ["receipt-storage", "رسیدها و نگهداری", "Receipts & retention", "shield"],
  ];
  if (mfa && passwordLogin) return <AdminChallenge locale={locale} />;
  if (mfa)
    return (
      <form
        className="login-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/api/auth/mfa", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Accept-Language": locale,
              },
              body: JSON.stringify({ code }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message);
            setMfa(false);
            await load();
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="small-icon">
          <Icon name="shield" />
        </span>
        <h1>{fa ? "تأیید دومرحله‌ای مدیر" : "Administrator verification"}</h1>
        <p style={{ margin: "15px 0" }}>
          {fa
            ? "کد برنامهٔ احراز هویت خود را وارد کنید."
            : "Enter the code from your authenticator app."}
        </p>
        <div className="field">
          <label htmlFor="mfa">{fa ? "کد شش‌رقمی" : "Six-digit code"}</label>
          <input
            id="mfa"
            dir="ltr"
            inputMode="numeric"
            pattern="[0-9]{6}"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
          />
        </div>
        <button className="button" disabled={busy}>
          {fa ? "ورود به مدیریت" : "Open administration"}
        </button>
        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
      </form>
    );
  return (
    <div className="dashboard-grid">
      <aside className="dashboard-nav">
        <div className="admin-nav-heading">
          <strong>{fa ? "پنل مدیریت مطب" : "Practice administration"}</strong>
          <a href={`/${locale}`} target="_blank" rel="noreferrer">
            {fa ? "مشاهده سایت ↗" : "View website ↗"}
          </a>
        </div>
        {tabs
          .filter(([key]) => key !== "roles" || data?.role === "super_admin")
          .filter(
            ([key]) =>
              data?.role !== "staff" ||
              [
                "overview",
                "appointments",
                "patients",
                "calendar",
                "security-login",
              ].includes(key),
          )
          .map(([key, f, e, icon]) => (
            <a
              href={`#${key}`}
              key={key}
              aria-current={tab === key ? "page" : undefined}
              className={tab === key ? "active" : ""}
              onClick={(ev) => {
                ev.preventDefault();
                setTab(key);
                window.history.replaceState(null, "", `#${key}`);
                setMessage("");
              }}
            >
              <Icon name={icon} size={18} />
              {fa ? f : e}
            </a>
          ))}
        <button
          type="button"
          className="admin-logout"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.reload();
          }}
        >
          {fa ? "خروج از حساب" : "Sign out"}
        </button>
      </aside>
      <div>
        <div className="dashboard-title">
          <div>
            <span className="eyebrow">
              {fa ? "مدیریت مطب" : "PRACTICE ADMINISTRATION"}
            </span>
            <h1>{tabs.find((t) => t[0] === tab)?.[fa ? 1 : 2]}</h1>
          </div>
          <span className="small-icon">
            <Icon name="bell" size={20} />
          </span>
        </div>
        {message && (
          <div className="notice" role="status" style={{ marginBottom: 20 }}>
            {message}
          </div>
        )}
        {!data ? (
          <div className="empty-state">
            <p>{fa ? "در حال دریافت اطلاعات…" : "Loading data…"}</p>
          </div>
        ) : (
          <>
            {tab === "security-login" && (
              <AdminSecuritySettings locale={locale} />
            )}
            {tab === "sms" && <AdminSecuritySettings locale={locale} onlySms />}
            {tab === "overview" && (
              <>
                <div className="stats-grid">
                  {(fa
                    ? [
                        "همهٔ نوبت‌ها",
                        "در انتظار بررسی",
                        "نوبت‌های تأییدشده",
                        "مشاوره‌های انجام‌شده",
                      ]
                    : [
                        "Appointments",
                        "Awaiting review",
                        "Confirmed",
                        "Completed",
                      ]
                  ).map((v, i) => (
                    <div className="stat-card" key={v}>
                      <span>{v}</span>
                      <strong>
                        {data.stats
                          ? [
                              data.stats.total,
                              data.stats.review,
                              data.stats.confirmed,
                              data.stats.completed,
                            ][i]
                          : data.appointments.filter(
                              (a) =>
                                i === 0 ||
                                a.status ===
                                  [
                                    "",
                                    "awaiting_verification",
                                    "confirmed",
                                    "completed",
                                  ][i],
                            ).length}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="content-panel">
                  <h2>{fa ? "فعالیت‌های اخیر" : "Recent activity"}</h2>
                  {data.audit.slice(0, 8).map((row) => (
                    <div className="summary-line" key={row.id}>
                      <strong>{auditLabel(row.action, fa)}</strong>
                      <time>{formatJalali(row.createdAt, true)}</time>
                    </div>
                  ))}
                  {!data.audit.length && (
                    <p>{fa ? "فعالیتی ثبت نشده است." : "No activity yet."}</p>
                  )}
                </div>
              </>
            )}
            {tab === "appointments" && (
              <AdminAppointmentList
                locale={locale}
                role={data.role}
                revision={data}
                onChanged={load}
              />
            )}
            {tab === "consultations" &&
              data.consultations.map((c) => (
                <ConsultationFees
                  key={c.id}
                  item={c}
                  locale={locale}
                  onSaved={load}
                />
              ))}
            {tab === "platforms" && (
              <p className="notice">
                {fa
                  ? "این شماره‌ها و شناسه‌ها فقط برای مشاوره هستند و از شبکه‌های اجتماعی فوتر مستقل‌اند. برای واتساپ شماره با کد کشور، برای تلگرام و بله شناسه یا لینک HTTPS وارد کنید. دکمه چت پس از تأیید پرداخت در پنل بیمار نمایش داده می‌شود؛ فایل و آزمایش از همان پیام‌رسان ارسال می‌شود."
                  : "Consultation contacts are separate from footer social links. Enter a WhatsApp number or a Telegram/Bale username or HTTPS link. Approved patients can open chat and send documents there."}
              </p>
            )}
            {tab === "platforms" && (
              <ContactCards
                platforms={data.platforms}
                locale={locale}
                busy={busy}
                save={save}
              />
            )}
            {tab === "articles" && (
              <>
                <ArticleEditor
                  locale={locale}
                  busy={busy}
                  save={async (...args) => {
                    await save(...args);
                  }}
                />
                <div style={{ marginTop: 25 }}>
                  <AdminOperations tab="articles" locale={locale} />
                </div>
              </>
            )}
            {[
              "social",
              "content",
              "branding",
              "seo",
              "settings",
              "contact",
              "policies",
            ].includes(tab) && (
              <AdminSiteSettings
                key={tab}
                tab={tab}
                locale={locale}
                settings={data.settings}
                content={data.content}
                busy={busy}
                save={async (...args) => {
                  await save(...args);
                }}
              />
            )}
            {tab === "receipt-storage" && (
              <ReceiptStorageSettings locale={locale} />
            )}
            {tab === "audit" && (
              <div className="content-panel admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {(fa
                        ? ["زمان", "رویداد", "بخش", "شناسه"]
                        : ["Time", "Event", "Section", "Reference"]
                      ).map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit.map((row) => (
                      <tr key={row.id}>
                        <td>{formatJalali(row.createdAt, true)}</td>
                        <td>{auditLabel(row.action, fa)}</td>
                        <td>{auditLabel(row.entityType, fa)}</td>
                        <td dir="ltr">{row.entityId || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.audit.length && (
                  <p>{fa ? "رویدادی ثبت نشده است." : "No events recorded."}</p>
                )}
              </div>
            )}
            {[
              "patients",
              "calendar",
              "sms",
              "roles",
              "banks",
              "appointment-requests",
            ].includes(tab) && (
              <AdminOperations
                key={tab}
                tab={tab}
                locale={locale}
                canManage={data.role !== "staff"}
                currentUserId={data.currentUserId}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
function auditLabel(action: string, fa: boolean) {
  if (!fa) return action.replace(/[._]/g, " ");
  const words: Record<string, string> = {
    admin: "مدیر",
    password_login: "ورود با رمز",
    mfa_verified: "تأیید دومرحله‌ای",
    login_policy_changed: "تغییر روش ورود",
    password_changed: "تغییر رمز",
    sms_settings_changed: "تنظیم پیامک",
    settings: "تنظیمات",
    update: "ویرایش",
    content: "محتوا",
    bank: "حساب بانکی",
    create: "ایجاد",
    article: "مقاله",
    save_draft: "ذخیره و انتشار",
    approve: "تأیید انتشار",
    auth: "ورود",
    mfa: "احراز هویت",
    user: "کاربر",
    role_update: "تغییر نقش",
    website: "سایت",
    image_upload: "آپلود عکس",
    website_image: "تصویر سایت",
    appointment: "نوبت",
    slot: "زمان رزرو",
    calendar: "تقویم",
    block: "تعطیلی",
    sms: "پیامک",
    template_update: "ویرایش قالب",
    retry: "ارسال مجدد",
    payment: "پرداخت",
    details_access: "مشاهده جزئیات",
    consultation: "مشاوره",
    platform: "پیام‌رسان",
    admin_security: "امنیت مدیر",
    notification: "اعلان",
    blocked_date: "تعطیلی",
  };
  return action
    .split(".")
    .map((w) => words[w] || w.replace(/_/g, " "))
    .join(" · ");
}
function ArticleEditor({
  locale,
  busy,
  save,
}: {
  locale: Locale;
  busy: boolean;
  save: (path: string, value: unknown, method?: string) => Promise<void>;
}) {
  const fa = locale === "fa";
  return (
    <form
      className="content-panel content-editor"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void save(
          "articles",
          {
            slug: f.get("slug"),
            locale: f.get("locale"),
            title: f.get("title"),
            body: withArticleCover(
              String(f.get("body") || ""),
              String(f.get("coverImage") || ""),
              String(f.get("title") || ""),
            ),
            description: f.get("description"),
          },
          "POST",
        );
      }}
    >
      <div className="notice warn" style={{ marginBottom: 20 }}>
        {fa
          ? "مقاله پس از ذخیره منتشر می‌شود. عنوان، توضیح جستجو و متن را کامل کنید. برای تیتر از ## و برای تصویر از ![توضیح تصویر](/مسیر-تصویر) استفاده کنید. امکان توقف انتشار از فهرست مقالات وجود دارد."
          : "Saving publishes this educational article. Use ## for headings and Markdown image links for illustrations. You can unpublish it from the article list."}
      </div>
      {[
        ["title", fa ? "عنوان مقاله" : "Article title"],
        ["slug", fa ? "نامک انگلیسی" : "English slug"],
        ["description", fa ? "توضیح SEO" : "SEO description"],
      ].map(([key, label]) => (
        <div className="field" key={key}>
          <label htmlFor={`article-${key}`}>{label}</label>
          <input id={`article-${key}`} name={key} required />
        </div>
      ))}
      <div className="field">
        <label htmlFor="article-locale">{fa ? "زبان" : "Language"}</label>
        <select id="article-locale" name="locale">
          <option value="fa">فارسی</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="article-body">
          {fa ? "متن مقاله" : "Article body"}
        </label>
        <textarea id="article-body" name="body" required minLength={20} />
      </div>
      <ArticleImageField fa={fa} />
      <button className="button" disabled={busy}>
        {fa ? "ذخیره و انتشار" : "Save & publish"}
        <Icon name="file" size={17} />
      </button>
    </form>
  );
}
