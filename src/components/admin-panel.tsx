"use client";
import { useEffect, useState } from "react";
import { type Locale } from "@/lib/content";
import { Icon, type IconName } from "./icon";
import { AdminOperations } from "./admin-operations";
import { AdminAppointmentActions } from "./admin-appointment-actions";
import { AdminChallenge } from "./admin-login";
import { AdminSecuritySettings } from "./admin-security-settings";
import { AdminSiteSettings, type ContentRow } from "./admin-site-settings";
import { ReceiptStorageSettings } from "./receipt-storage-settings";
import { adminLabel } from "@/lib/admin-labels";
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
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
    } catch (e) {
      setMessage((e as Error).message);
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
    ["platforms", "پیام‌رسان‌ها", "Messaging platforms", "message"],
    ["sms", "مدیریت پیامک", "SMS management", "phone"],
    ["articles", "مقالات پزشکی", "Medical articles", "file"],
    ["content", "محتوای سایت", "Website content", "file"],
    ["branding", "تصاویر و هویت بصری", "Images & branding", "settings"],
    ["contact", "اطلاعات تماس", "Contact details", "phone"],
    ["policies", "حریم خصوصی و شرایط", "Privacy & terms", "shield"],
    ["seo", "تنظیمات SEO", "SEO settings", "globe"],
    ["roles", "کاربران و نقش‌ها", "Users & roles", "shield"],
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
                      <time>
                        {new Date(row.createdAt).toLocaleString(
                          fa ? "fa-IR" : "en-US",
                          { timeZone: "Asia/Tehran" },
                        )}
                      </time>
                    </div>
                  ))}
                  {!data.audit.length && (
                    <p>{fa ? "فعالیتی ثبت نشده است." : "No activity yet."}</p>
                  )}
                </div>
              </>
            )}
            {tab === "appointments" && (
              <>
                <div className="two-cols">
                  <div className="field">
                    <label htmlFor="appointment-search">
                      {fa
                        ? "جست‌وجوی نام، شماره همراه یا کد پیگیری"
                        : "Search name, phone or tracking code"}
                    </label>
                    <input
                      id="appointment-search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="appointment-filter">
                      {fa ? "وضعیت" : "Status"}
                    </label>
                    <select
                      id="appointment-filter"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="">{fa ? "همه" : "All"}</option>
                      {[
                        "awaiting_payment",
                        "awaiting_verification",
                        "awaiting_scheduling",
                        "confirmed",
                        "in_progress",
                        "completed",
                        "cancelled",
                        "expired",
                      ].map((v) => (
                        <option key={v} value={v}>
                          {adminLabel(v, fa)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {!data.appointments.length ? (
                  <div className="empty-state">
                    <h2>
                      {fa
                        ? "نوبتی برای بررسی وجود ندارد"
                        : "No appointments to review"}
                    </h2>
                  </div>
                ) : (
                  data.appointments
                    .filter(
                      (a) =>
                        (!filter || a.status === filter) &&
                        `${a.trackingCode} ${a.patientName || ""} ${a.patientPhone || ""}`.includes(
                          search,
                        ),
                    )
                    .map((a) => (
                      <div
                        className="content-panel"
                        key={a.id}
                        style={{ marginBottom: 15 }}
                      >
                        <strong dir="ltr">{a.trackingCode}</strong>
                        <p>
                          {a.patientName || (fa ? "بیمار" : "Patient")} ·{" "}
                          <span dir="ltr">{a.patientPhone}</span>
                        </p>
                        <p>
                          {fa ? "مبلغ: " : "Amount: "}
                          {a.priceRial.toLocaleString(
                            fa ? "fa-IR" : "en-US",
                          )}{" "}
                          {fa ? "ریال" : "IRR"}
                        </p>
                        <p>
                          {adminLabel(a.status, fa)} /{" "}
                          {adminLabel(a.paymentStatus, fa)}
                        </p>
                        {data.role !== "staff" &&
                          a.paymentStatus === "under_review" && (
                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                className="button button-small"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      fa
                                        ? "آیا واریز را مستقلاً در حساب بانکی بررسی و تأیید کرده‌اید؟"
                                        : "Have you independently verified the deposit in the bank account?",
                                    )
                                  )
                                    void save(
                                      `appointments/${a.id}/payment`,
                                      {
                                        action: "approve",
                                        bankDepositVerified: true,
                                        idempotencyKey: crypto.randomUUID(),
                                      },
                                      "POST",
                                    );
                                }}
                              >
                                {fa
                                  ? "تأیید واریز بانکی"
                                  : "Approve verified deposit"}
                              </button>
                              <button
                                className="button button-small button-white"
                                style={{ borderColor: "#ddd" }}
                                disabled={busy}
                                onClick={() =>
                                  save(
                                    `appointments/${a.id}/payment`,
                                    {
                                      action: "reject",
                                      idempotencyKey: crypto.randomUUID(),
                                    },
                                    "POST",
                                  )
                                }
                              >
                                {fa ? "رد پرداخت" : "Reject payment"}
                              </button>
                              <button
                                className="text-link"
                                style={{ background: "none" }}
                                disabled={busy}
                                onClick={() =>
                                  save(
                                    `appointments/${a.id}/payment`,
                                    {
                                      action: "request_information",
                                      idempotencyKey: crypto.randomUUID(),
                                    },
                                    "POST",
                                  )
                                }
                              >
                                {fa
                                  ? "درخواست رسید مجدد"
                                  : "Request receipt resubmission"}
                              </button>
                            </div>
                          )}
                        {data.role !== "staff" && (
                          <AdminAppointmentActions
                            locale={locale}
                            id={a.id}
                            consultationTypeId={a.consultationTypeId}
                            status={a.status}
                            onChange={load}
                          />
                        )}
                      </div>
                    ))
                )}
              </>
            )}
            {tab === "consultations" &&
              data.consultations.map((c) => (
                <form
                  className="content-panel"
                  style={{ marginBottom: 20 }}
                  key={c.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void save(`consultations/${c.id}`, {
                      priceRial: Number(f.get("price")),
                      durationMinutes: Number(f.get("duration")),
                      bufferMinutes: Number(f.get("buffer")),
                      enabled: f.get("enabled") === "on",
                    });
                  }}
                >
                  <h2>
                    {c.key === "phone"
                      ? fa
                        ? "مشاوره تلفنی"
                        : "Phone consultation"
                      : fa
                        ? "مشاوره متنی"
                        : "Text consultation"}
                  </h2>
                  <div className="two-cols">
                    <div className="field">
                      <label htmlFor={`price-${c.id}`}>
                        {fa ? "تعرفه (ریال)" : "Price (IRR)"}
                      </label>
                      <input
                        id={`price-${c.id}`}
                        name="price"
                        type="number"
                        required
                        min="0"
                        defaultValue={c.priceRial}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`duration-${c.id}`}>
                        {fa ? "مدت (دقیقه)" : "Duration (minutes)"}
                      </label>
                      <input
                        id={`duration-${c.id}`}
                        name="duration"
                        type="number"
                        required
                        min="5"
                        max="180"
                        defaultValue={c.durationMinutes}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`buffer-${c.id}`}>
                      {fa ? "فاصله بین نوبت‌ها (دقیقه)" : "Buffer (minutes)"}
                    </label>
                    <input
                      id={`buffer-${c.id}`}
                      name="buffer"
                      type="number"
                      required
                      min="0"
                      defaultValue={c.bufferMinutes}
                    />
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={c.enabled}
                    />
                    {fa ? "فعال برای رزرو" : "Available for booking"}
                  </label>
                  <button className="button button-small" disabled={busy}>
                    {fa ? "ذخیره تغییرات" : "Save changes"}
                  </button>
                </form>
              ))}
            {tab === "platforms" &&
              data.platforms.map((p) => (
                <form
                  className="content-panel"
                  key={p.id}
                  style={{ marginBottom: 20 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void save(`platforms/${p.id}`, {
                      enabled: f.get("enabled") === "on",
                      contactNumber: f.get("phone") || null,
                      username: f.get("username") || null,
                      link: f.get("link") || null,
                    });
                  }}
                >
                  <h2>{adminLabel(p.key, fa)}</h2>
                  {[
                    [
                      "phone",
                      fa ? "شماره تماس" : "Contact number",
                      p.contactNumber,
                    ],
                    ["username", fa ? "نام کاربری" : "Username", p.username],
                    ["link", fa ? "لینک HTTPS" : "HTTPS link", p.link],
                  ].map(([name, label, value]) => (
                    <div className="field" key={name}>
                      <label htmlFor={`${p.id}-${name}`}>{label}</label>
                      <input
                        id={`${p.id}-${name}`}
                        name={name!}
                        defaultValue={value || ""}
                        dir="ltr"
                      />
                    </div>
                  ))}
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={p.enabled}
                    />
                    {fa ? "فعال" : "Enabled"}
                  </label>
                  <button className="button button-small" disabled={busy}>
                    {fa ? "ذخیره" : "Save"}
                  </button>
                </form>
              ))}
            {tab === "articles" && (
              <>
                <ArticleEditor locale={locale} busy={busy} save={save} />
                <div style={{ marginTop: 25 }}>
                  <AdminOperations tab="articles" locale={locale} />
                </div>
              </>
            )}
            {[
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
                save={save}
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
                        <td>
                          {new Date(row.createdAt).toLocaleString(
                            fa ? "fa-IR" : "en-US",
                            { timeZone: "Asia/Tehran" },
                          )}
                        </td>
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
    save_draft: "ذخیره پیش‌نویس",
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
            body: f.get("body"),
            description: f.get("description"),
          },
          "POST",
        );
      }}
    >
      <div className="notice warn" style={{ marginBottom: 20 }}>
        {fa
          ? "مطالب به‌صورت پیش‌نویس ذخیره می‌شوند. انتشار فقط پس از بررسی علمی و تأیید صریح پزشک مجاز است."
          : "Articles are saved as drafts. Publication requires explicit medical review and approval."}
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
      <button className="button" disabled={busy}>
        {fa ? "ذخیره پیش‌نویس" : "Save draft"}
        <Icon name="file" size={17} />
      </button>
    </form>
  );
}
