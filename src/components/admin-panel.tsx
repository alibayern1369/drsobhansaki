"use client";
import { useEffect, useState } from "react";
import { type Locale } from "@/lib/content";
import { Icon, type IconName } from "./icon";
import { AdminOperations } from "./admin-operations";
import { AdminAppointmentActions } from "./admin-appointment-actions";
import { ReceiptStorageSettings } from "./receipt-storage-settings";
type AdminData = {
  appointments: Array<{
    id: string;
    trackingCode: string;
    status: string;
    paymentStatus: string;
    priceRial: number;
    consultationTypeId: string;
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
  content: unknown[];
  articles: unknown[];
  audit: unknown[];
  settings: Array<{ key: string; value: unknown }>;
};
export function AdminPanel({
  locale,
  mfaRequired,
}: {
  locale: Locale;
  mfaRequired: boolean;
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
      }).then(async (r) => {
        const d = await r.json();
        if (r.ok) setData(d);
        else setMessage(d.message);
      });
  }, [mfaRequired, locale]);
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
    ["overview", "نمای کلی", "Overview", "dashboard"],
    [
      "appointments",
      "نوبت‌ها و پرداخت‌ها",
      "Appointments & payments",
      "calendar",
    ],
    ["patients", "بیماران", "Patients", "user"],
    ["consultations", "خدمات و تعرفه‌ها", "Consultations & pricing", "doctor"],
    ["banks", "حساب‌های بانکی", "Bank accounts", "copy"],
    ["calendar", "تقویم", "Calendar", "calendar"],
    ["platforms", "پیام‌رسان‌ها", "Messaging platforms", "message"],
    ["sms", "مدیریت پیامک", "SMS management", "phone"],
    ["articles", "مقالات پزشکی", "Medical articles", "file"],
    ["content", "محتوای سایت", "Website content", "file"],
    ["branding", "هویت بصری", "Branding", "settings"],
    ["seo", "تنظیمات SEO", "SEO settings", "globe"],
    ["roles", "کاربران و نقش‌ها", "Users & roles", "shield"],
    ["audit", "گزارش امنیتی", "Security logs", "lock"],
    ["settings", "تنظیمات سامانه", "System settings", "settings"],
    ["receipt-storage", "رسیدها و نگهداری", "Receipts & retention", "shield"],
  ];
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
        {tabs.map(([key, f, e, icon]) => (
          <a
            href={`#${key}`}
            key={key}
            className={tab === key ? "active" : ""}
            onClick={(ev) => {
              ev.preventDefault();
              setTab(key);
              setMessage("");
            }}
          >
            <Icon name={icon} size={18} />
            {fa ? f : e}
          </a>
        ))}
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
                        {
                          data.appointments.filter(
                            (a) =>
                              i === 0 ||
                              a.status ===
                                [
                                  "",
                                  "awaiting_verification",
                                  "confirmed",
                                  "completed",
                                ][i],
                          ).length
                        }
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="content-panel">
                  <h2>{fa ? "فعالیت‌های اخیر" : "Recent activity"}</h2>
                  <pre className="data-preview">
                    {JSON.stringify(data.audit.slice(0, 8), null, 2)}
                  </pre>
                </div>
              </>
            )}
            {tab === "appointments" && (
              <>
                {!data.appointments.length ? (
                  <div className="empty-state">
                    <h2>
                      {fa
                        ? "نوبتی برای بررسی وجود ندارد"
                        : "No appointments to review"}
                    </h2>
                  </div>
                ) : (
                  data.appointments.map((a) => (
                    <div
                      className="content-panel"
                      key={a.id}
                      style={{ marginBottom: 15 }}
                    >
                      <strong dir="ltr">{a.trackingCode}</strong>
                      <p>
                        {a.status} / {a.paymentStatus}
                      </p>
                      {a.paymentStatus === "under_review" && (
                        <div
                          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
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
                      <AdminAppointmentActions
                        locale={locale}
                        id={a.id}
                        consultationTypeId={a.consultationTypeId}
                        status={a.status}
                        onChange={load}
                      />
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
                  <h2>{p.key}</h2>
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
            {tab === "content" && (
              <JsonEditor
                locale={locale}
                initial={{
                  key: "homepage",
                  locale: "fa",
                  published: false,
                  value: {},
                }}
                onSave={(value) => save("content", value)}
                description={
                  fa
                    ? "کلیدهای متن صفحهٔ اصلی را برای هر زبان ویرایش کنید. انتشار محتوا نیازمند تأیید شماست."
                    : "Edit homepage text keys per locale. Publishing requires your approval."
                }
              />
            )}
            {tab === "receipt-storage" && (
              <ReceiptStorageSettings locale={locale} />
            )}
            {["branding", "seo", "settings"].includes(tab) && (
              <JsonEditor
                key={tab}
                locale={locale}
                initial={
                  data.settings.find(
                    (s) => s.key === (tab === "settings" ? "booking" : tab),
                  )?.value ||
                  (tab === "branding"
                    ? {
                        primaryColor: "#0866ff",
                        logoUrl: null,
                        lightFaviconUrl: null,
                        darkFaviconUrl: null,
                      }
                    : tab === "settings"
                      ? {
                          enabled: false,
                          patientScheduling: false,
                          doctorScheduling: false,
                        }
                      : {
                          title: {
                            fa: "دکتر سبحان ساکی",
                            en: "Dr. Sobhan Saki",
                          },
                        })
                }
                onSave={(value) =>
                  save("settings", {
                    key: tab === "settings" ? "booking" : tab,
                    value,
                  })
                }
                description={
                  fa
                    ? "تنظیمات ساختاریافتهٔ سامانه؛ قبل از فعال‌سازی رزرو، حساب بانکی و برنامه را تأیید کنید."
                    : "Structured configuration. Verify bank accounts and scheduling before enabling bookings."
                }
              />
            )}
            {tab === "audit" && (
              <div className="content-panel">
                <pre className="data-preview">
                  {JSON.stringify(data.audit, null, 2)}
                </pre>
              </div>
            )}
            {["patients", "calendar", "sms", "roles", "banks"].includes(
              tab,
            ) && <AdminOperations key={tab} tab={tab} locale={locale} />}
          </>
        )}
      </div>
    </div>
  );
}
function JsonEditor({
  locale,
  initial,
  onSave,
  description,
}: {
  locale: Locale;
  initial: unknown;
  onSave: (value: unknown) => void;
  description: string;
}) {
  const [value, setValue] = useState(JSON.stringify(initial, null, 2));
  const [error, setError] = useState("");
  return (
    <form
      className="content-panel content-editor"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onSave(JSON.parse(value));
          setError("");
        } catch {
          setError(
            locale === "fa" ? "ساختار JSON معتبر نیست." : "Invalid JSON.",
          );
        }
      }}
    >
      <p>{description}</p>
      <div className="field">
        <label htmlFor="json-editor">
          {locale === "fa" ? "تنظیمات" : "Configuration"}
        </label>
        <textarea
          dir="ltr"
          id="json-editor"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="button button-small">
        {locale === "fa" ? "ذخیره تغییرات" : "Save changes"}
      </button>
    </form>
  );
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
