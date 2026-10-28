"use client";
import { ArticleImageField, withArticleCover } from "./article-image-field";
import { formatJalali } from "@/lib/jalali";
import { JalaliDatePicker, PersianTimeInput } from "./jalali-date-picker";
import { useEffect, useState } from "react";
import { type Locale } from "@/lib/content";
import { Icon } from "./icon";
import { adminLabel, normalizeDigits } from "@/lib/admin-labels";
import { SmsWorkflowSettings } from "./sms-workflow-settings";
import { isSmsEvent } from "@/lib/sms-workflow";
import { formatPhone } from "@/lib/phone-display";
import { AdminAccountCreator } from "./admin-account-creator";
import { BankCard, BankLogo } from "./bank-card";
import { iranianBanks } from "@/lib/iranian-banks";
type Row = Record<string, string | number | boolean | null>;
type Collection = {
  slots?: Row[];
  availability?: Row[];
  blocked?: Row[];
  types?: Row[];
  templates?: Array<{
    key: string;
    content: { fa: string; en: string; patternId?: string };
    enabled: boolean;
  }>;
  deliveries?: Row[];
};
export function AdminOperations({
  tab,
  locale,
  canManage = true,
  currentUserId,
}: {
  tab: string;
  locale: Locale;
  canManage?: boolean;
  currentUserId?: string;
}) {
  const fa = locale === "fa";
  const [data, setData] = useState<Row[] | Collection | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<
    Record<string, { role: string; disabled: boolean }>
  >({});
  const [batchBusy, setBatchBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const endpoint = tab === "articles" ? "article-list" : tab;
  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/${endpoint}`, {
      headers: { "Accept-Language": locale },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [endpoint, locale]);
  async function save(path: string, value: unknown, method = "PUT") {
    setBusy(true);
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
      setMessage(
        typeof d.count === "number"
          ? fa
            ? `${d.count} زمان جدید ساخته شد؛ زمان‌های تکراری اضافه نشدند.`
            : `Created ${d.count} new times; duplicates skipped.`
          : d.retained
            ? fa
              ? "کارت از فهرست حذف شد؛ سوابق پرداخت محفوظ است."
              : "Card removed; payment history preserved."
            : fa
              ? "ذخیره شد."
              : "Saved.",
      );
      const reload = await fetch(`/api/admin/${endpoint}`, {
        headers: { "Accept-Language": locale },
      });
      if (reload.ok) setData(await reload.json());
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const collection = !Array.isArray(data) ? data : null;
  const rows = Array.isArray(data) ? data : [];
  return (
    <div>
      {message && (
        <div className="notice" role="status" style={{ marginBottom: 20 }}>
          {message}
        </div>
      )}
      {!data ? (
        <p>
          {message
            ? fa
              ? "دریافت اطلاعات انجام نشد. دوباره وارد این بخش شوید."
              : "Unable to load data. Reopen this section."
            : fa
              ? "در حال دریافت اطلاعات…"
              : "Loading data…"}
        </p>
      ) : (
        <>
          {tab === "appointment-requests" && (
            <>
              <p>
                {fa
                  ? "ابتدا لغو یا تغییر زمان را در بخش نوبت‌ها انجام دهید، سپس درخواست را رسیدگی‌شده علامت بزنید. بستن درخواست، وضعیت خود نوبت را تغییر نمی‌دهد."
                  : "Handle cancellation or rescheduling under Appointments first, then close the request. Closing does not change the appointment."}
              </p>
              {!rows.length && (
                <p>
                  {fa
                    ? "درخواست بررسی‌نشده‌ای وجود ندارد."
                    : "No pending requests."}
                </p>
              )}
              {rows.map((row) => (
                <div className="content-panel" key={String(row.id)}>
                  <h3>{adminLabel(row.kind, fa)}</h3>
                  <p>
                    {row.name || (
                      <bdi dir="ltr">
                        {formatPhone(String(row.phone || ""))}
                      </bdi>
                    )}
                  </p>
                  <p dir="ltr">{row.trackingCode}</p>
                  <time>{formatJalali(String(row.createdAt), true)}</time>
                  <div className="admin-actions">
                    <button
                      className="button button-small"
                      disabled={busy}
                      onClick={() =>
                        void save(`appointment-requests/${row.id}`, {
                          status: "resolved",
                        })
                      }
                    >
                      {fa ? "رسیدگی انجام شد" : "Mark handled"}
                    </button>
                    <button
                      className="button button-white button-small"
                      disabled={busy}
                      onClick={() =>
                        void save(`appointment-requests/${row.id}`, {
                          status: "rejected",
                        })
                      }
                    >
                      {fa ? "رد درخواست" : "Decline request"}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
          {tab === "patients" && (
            <>
              <p className="notice">
                {fa
                  ? "بیماران با رمز یک‌بارمصرف شماره همراه وارد پنل خود می‌شوند و دسترسی به مدیریت سایت ندارند. این فهرست شامل ۲۰۰ حساب اخیر است."
                  : "Patients sign in with mobile OTP and have no site administration access. Showing the 200 most recent accounts."}
              </p>
              <div className="field">
                <label htmlFor="patient-search">
                  {fa
                    ? "جست‌وجوی نام یا شماره همراه"
                    : "Search by name or mobile"}
                </label>
                <input
                  id="patient-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={fa ? "جست‌وجوی بیمار…" : "Search patients…"}
                />
              </div>
              <div className="patient-table">
                <div className="patient-table-heading">
                  <span>{fa ? "بیمار" : "Patient"}</span>
                  <span>{fa ? "شماره همراه" : "Mobile"}</span>
                  <span>{fa ? "عضویت" : "Registered"}</span>
                  <span>{fa ? "حساب" : "Account"}</span>
                </div>
                {rows
                  .filter((r) =>
                    normalizeDigits(String(r.name || "") + String(r.phone))
                      .toLowerCase()
                      .includes(normalizeDigits(search).toLowerCase()),
                  )
                  .map((r) => (
                    <div className="patient-table-row" key={String(r.id)}>
                      <strong>
                        <span className="patient-avatar">
                          <Icon name="user" size={18} />
                        </span>
                        {r.name || (fa ? "نام ثبت نشده" : "Name not provided")}
                      </strong>
                      <bdi dir="ltr">{formatPhone(String(r.phone || ""))}</bdi>
                      <span>{formatJalali(String(r.createdAt))}</span>
                      <span className="pill">
                        {r.disabled
                          ? fa
                            ? "غیرفعال"
                            : "Disabled"
                          : fa
                            ? "فعال"
                            : "Active"}
                      </span>
                    </div>
                  ))}
              </div>
              {!rows.length && (
                <p>{fa ? "بیماری ثبت نشده است." : "No patients registered."}</p>
              )}
            </>
          )}
          {tab === "roles" && (
            <>
              <p className="notice">
                {fa
                  ? "این بخش فقط مدیران و کارکنان مجاز را نشان می‌دهد. بیماران در منوی بیماران جدا هستند و با رمز یک‌بارمصرف موبایل وارد می‌شوند. ورود مدیران با نام کاربری و گذرواژه انجام می‌شود."
                  : "Staff accounts use administrator credentials. Patients are listed separately and sign in using mobile OTP."}
              </p>
              <details className="staff-account">
                <summary>
                  {fa
                    ? "افزودن مدیر یا همکار جدید"
                    : "Add an administrator or staff member"}
                </summary>
                <AdminAccountCreator
                  locale={locale}
                  onCreated={async () => {
                    const response = await fetch("/api/admin/roles");
                    if (response.ok) setData(await response.json());
                  }}
                />
              </details>
              <div className="field">
                <label htmlFor="staff-search">
                  {fa ? "جست‌وجوی مدیر و همکار" : "Find a staff account"}
                </label>
                <input
                  id="staff-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const changes = rows
                    .filter((r) => r.id !== currentUserId)
                    .map((r) => ({
                      id: r.id,
                      role: roleDrafts[String(r.id)]?.role ?? String(r.role),
                      disabled:
                        roleDrafts[String(r.id)]?.disabled ?? !!r.disabled,
                    }))
                    .filter((v) => {
                      const r = rows.find((r) => r.id === v.id)!;
                      return r.role !== v.role || !!r.disabled !== v.disabled;
                    });
                  setBatchBusy(true);
                  try {
                    for (const v of changes) {
                      if (
                        !(await save(`roles/${v.id}`, {
                          role: v.role,
                          disabled: v.disabled,
                        }))
                      )
                        break;
                      setRoleDrafts((current) => {
                        const next = { ...current };
                        delete next[String(v.id)];
                        return next;
                      });
                    }
                  } finally {
                    setBatchBusy(false);
                  }
                }}
              >
                <div className="staff-card-grid">
                  {rows
                    .filter((r) =>
                      normalizeDigits(
                        `${r.name || ""} ${r.phone || ""} ${r.username || ""}`,
                      )
                        .toLowerCase()
                        .includes(normalizeDigits(search).toLowerCase()),
                    )
                    .map((r) => (
                      <details className="staff-account" key={String(r.id)}>
                        <summary>
                          <strong>{String(r.name || r.phone)}</strong> ·{" "}
                          {String(r.username || "")} ·{" "}
                          {adminLabel(String(r.role), fa)}
                        </summary>
                        <div className="content-panel">
                          <strong>
                            {r.name || (
                              <bdi dir="ltr">
                                {formatPhone(String(r.phone || ""))}
                              </bdi>
                            )}
                          </strong>
                          <div className="field">
                            <label htmlFor={`role-${r.id}`}>
                              {fa ? "نقش" : "Role"}
                            </label>
                            <select
                              id={`role-${r.id}`}
                              name={`role-${r.id}`}
                              disabled={batchBusy || r.id === currentUserId}
                              value={
                                roleDrafts[String(r.id)]?.role ?? String(r.role)
                              }
                              onChange={(e) =>
                                setRoleDrafts((d) => ({
                                  ...d,
                                  [String(r.id)]: {
                                    role: e.target.value,
                                    disabled:
                                      d[String(r.id)]?.disabled ?? !!r.disabled,
                                  },
                                }))
                              }
                            >
                              {[
                                ["staff", "کارمند مجاز", "Authorized staff"],
                                ["doctor", "پزشک", "Doctor"],
                                [
                                  "super_admin",
                                  "مدیر کل",
                                  "Super administrator",
                                ],
                              ].map(([v, f, e]) => (
                                <option key={v} value={v}>
                                  {fa ? f : e}
                                </option>
                              ))}
                            </select>
                          </div>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              name={`disabled-${r.id}`}
                              disabled={batchBusy || r.id === currentUserId}
                              checked={
                                roleDrafts[String(r.id)]?.disabled ??
                                !!r.disabled
                              }
                              onChange={(e) =>
                                setRoleDrafts((d) => ({
                                  ...d,
                                  [String(r.id)]: {
                                    role:
                                      d[String(r.id)]?.role ?? String(r.role),
                                    disabled: e.target.checked,
                                  },
                                }))
                              }
                            />
                            {fa ? "غیرفعال کردن حساب" : "Disable account"}
                          </label>
                        </div>
                      </details>
                    ))}
                </div>
                <div className="batch-save-bar">
                  <button className="button" disabled={busy || batchBusy}>
                    {fa ? "ذخیره تغییرات کارکنان" : "Save staff changes"}
                  </button>
                </div>
              </form>
            </>
          )}
          {tab === "calendar" && collection && (
            <>
              <form
                hidden={!canManage}
                className="content-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void save(
                    "slot-batch",
                    {
                      consultationTypeId: f.get("type"),
                      date: f.get("date"),
                      startTime: f.get("start"),
                      endTime: f.get("end"),
                    },
                    "POST",
                  );
                }}
              >
                <h2>
                  {fa
                    ? "ساخت خودکار زمان‌های یک روز"
                    : "Generate a day of appointments"}
                </h2>
                <p>
                  {fa
                    ? "بازهٔ کاری را وارد کنید؛ زمان‌ها با مدت مشاوره و فاصلهٔ بین نوبت‌ها ساخته می‌شوند. تاریخ بر اساس تقویم شمسی جلالی و ساعت تهران است."
                    : "Times use the consultation duration and buffer, in Tehran time."}
                </p>
                <div className="field">
                  <label htmlFor="batch-type">
                    {fa ? "نوع مشاوره" : "Consultation"}
                  </label>
                  <select id="batch-type" name="type" required>
                    {collection.types?.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>
                        {adminLabel(t.key, fa)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="batch-date">{fa ? "تاریخ" : "Date"}</label>
                  <JalaliDatePicker id="batch-date" name="date" required />
                </div>
                <div className="two-cols">
                  {["start", "end"].map((k, i) => (
                    <div className="field" key={k}>
                      <label htmlFor={`batch-${k}`}>
                        {fa
                          ? i
                            ? "پایان کار"
                            : "شروع کار"
                          : i
                            ? "End"
                            : "Start"}
                      </label>
                      <PersianTimeInput id={`batch-${k}`} name={k} required />
                    </div>
                  ))}
                </div>
                <button className="button button-small" disabled={busy}>
                  {fa ? "ساخت زمان‌های قابل رزرو" : "Generate bookable times"}
                </button>
              </form>
              <form
                className="content-panel"
                hidden={!canManage}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void save(
                    "slots",
                    {
                      consultationTypeId: f.get("type"),
                      startsAt: tehranIso(String(f.get("start"))),
                      endsAt: tehranIso(String(f.get("end"))),
                    },
                    "POST",
                  );
                }}
              >
                <h2>{fa ? "افزودن زمان قابل رزرو" : "Add a bookable time"}</h2>
                <div className="field">
                  <label htmlFor="slot-type">
                    {fa ? "نوع مشاوره" : "Consultation type"}
                  </label>
                  <select id="slot-type" name="type" required>
                    {collection.types?.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>
                        {t.key === "phone"
                          ? fa
                            ? "تلفنی"
                            : "Phone"
                          : fa
                            ? "متنی"
                            : "Text"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="two-cols">
                  {[
                    ["start", fa ? "شروع (تهران)" : "Start (Tehran)"],
                    ["end", fa ? "پایان (تهران)" : "End (Tehran)"],
                  ].map(([key, label]) => (
                    <div className="field" key={key}>
                      <label htmlFor={`slot-${key}`}>{label}</label>
                      <JalaliDatePicker
                        dateTime
                        name={key}
                        id={`slot-${key}`}
                        required
                      />
                    </div>
                  ))}
                </div>
                <button className="button button-small" disabled={busy}>
                  {fa ? "ثبت زمان" : "Add time"}
                </button>
              </form>
              <form
                className="content-panel"
                style={{ marginTop: 20 }}
                hidden={!canManage}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void save(
                    "blocked-dates",
                    {
                      startsAt: tehranIso(String(f.get("start"))),
                      endsAt: tehranIso(String(f.get("end"))),
                      reason: f.get("reason"),
                    },
                    "POST",
                  );
                }}
              >
                <h2>
                  {fa ? "مسدود کردن بازه / تعطیلی" : "Block a period / holiday"}
                </h2>
                <div className="two-cols">
                  {["start", "end"].map((key, i) => (
                    <div className="field" key={key}>
                      <label htmlFor={`blocked-${key}`}>
                        {fa
                          ? i
                            ? "پایان (تهران)"
                            : "شروع (تهران)"
                          : i
                            ? "End (Tehran)"
                            : "Start (Tehran)"}
                      </label>
                      <JalaliDatePicker
                        dateTime
                        name={key}
                        id={`blocked-${key}`}
                        required
                      />
                    </div>
                  ))}
                </div>
                <div className="field">
                  <label htmlFor="block-reason">
                    {fa ? "یادداشت" : "Note"}
                  </label>
                  <input name="reason" id="block-reason" maxLength={200} />
                </div>
                <button className="button button-small" disabled={busy}>
                  {fa ? "ثبت تعطیلی" : "Block period"}
                </button>
              </form>
              <h2 style={{ fontSize: 21, margin: "25px 0 15px" }}>
                {fa ? "زمان‌های آینده" : "Upcoming times"}
              </h2>
              {!collection.slots?.length && (
                <p>
                  {fa
                    ? "زمانی تعریف نشده است. از فرم بالا زمان اضافه کنید."
                    : "No times yet. Add times above."}
                </p>
              )}
              {collection.slots?.map((s) => (
                <div className="summary-line" key={String(s.id)}>
                  <strong>{formatJalali(String(s.startsAt), true)}</strong>
                  <button
                    className="text-link"
                    style={{ background: "none" }}
                    disabled={busy || !canManage}
                    onClick={() =>
                      save(`slots/${s.id}`, { enabled: !s.enabled })
                    }
                  >
                    {s.enabled
                      ? fa
                        ? "غیرفعال کردن"
                        : "Disable"
                      : fa
                        ? "فعال کردن"
                        : "Enable"}
                  </button>
                </div>
              ))}
              <h2>{fa ? "تعطیلی‌ها و بازه‌های مسدود" : "Blocked periods"}</h2>
              {!collection.blocked?.length && (
                <p>{fa ? "تعطیلی ثبت نشده است." : "No blocked periods."}</p>
              )}
              {collection.blocked?.map((row) => (
                <div className="summary-line" key={String(row.id)}>
                  <span>
                    {formatJalali(String(row.startsAt), true)} —{" "}
                    {formatJalali(String(row.endsAt), true)}
                    <br />
                    {row.reason}
                  </span>
                  <button
                    className="text-link"
                    disabled={busy || !canManage}
                    onClick={() =>
                      void save(`blocked-dates/${row.id}`, { remove: true })
                    }
                  >
                    {fa ? "حذف تعطیلی" : "Remove block"}
                  </button>
                </div>
              ))}
            </>
          )}
          {tab === "sms" && collection && (
            <>
              <SmsWorkflowSettings
                templates={collection.templates || []}
                locale={locale}
                busy={busy}
                save={save}
              />
              <h2 style={{ fontSize: 21, margin: "25px 0 15px" }}>
                {fa ? "گزارش تحویل" : "Delivery log"}
              </h2>
              {collection.deliveries
                ?.filter((n) => isSmsEvent(String(n.event)))
                .map((n) => (
                  <div key={String(n.id)} className="summary-line">
                    <span>
                      {adminLabel(n.event, fa)} · {adminLabel(n.status, fa)} ·{" "}
                      {n.attempts}
                      {n.lastError && (
                        <small style={{ display: "block" }}>
                          {fa ? "آخرین خطا: " : "Last error: "}
                          {String(n.lastError) === "SMS_NOT_CONFIGURED"
                            ? fa
                              ? "تنظیمات سرویس پیامک کامل نیست"
                              : "SMS provider is not configured"
                            : adminLabel(n.lastError, fa)}
                        </small>
                      )}
                      {n.status === "pending" && n.nextAttemptAt && (
                        <small style={{ display: "block" }}>
                          {fa
                            ? "امکان تلاش بعدی از: "
                            : "Next retry eligible: "}
                          {formatJalali(String(n.nextAttemptAt), true)}
                        </small>
                      )}
                    </span>
                    {n.status === "failed" && (
                      <button
                        className="text-link"
                        style={{ background: "none" }}
                        disabled={busy}
                        onClick={() => save(`sms-retry/${n.id}`, {}, "POST")}
                      >
                        {fa ? "تلاش مجدد" : "Retry"}
                      </button>
                    )}
                  </div>
                ))}
            </>
          )}
          {tab === "banks" && (
            <>
              <details className="staff-account">
                <summary>{fa ? "افزودن کارت بانکی" : "Add bank card"}</summary>
                <BankEditor
                  locale={locale}
                  busy={busy}
                  onSave={(v) => save("banks", v, "POST")}
                />
              </details>
              <div className="bank-card-grid">
                {rows.map((b) => (
                  <section className="bank-management-card" key={String(b.id)}>
                    <BankCard
                      bank={{
                        bankName: String(b.bankName),
                        holderName: String(b.holderName),
                        cardNumber: String(b.cardNumber),
                      }}
                      locale={locale}
                    />
                    <div className="card-actions">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={!!b.enabled}
                          disabled={busy}
                          onChange={(e) =>
                            void save(`banks/${b.id}`, {
                              ...b,
                              enabled: e.target.checked,
                            })
                          }
                        />
                        {fa ? "فعال برای پرداخت" : "Active for payments"}
                      </label>
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              fa
                                ? "این کارت از فهرست حذف شود؟ سوابق پرداخت حفظ می‌شوند."
                                : "Remove this card? Payment history will be preserved.",
                            )
                          )
                            void save(`banks/${b.id}`, {}, "DELETE");
                        }}
                      >
                        {fa ? "حذف" : "Delete"}
                      </button>
                    </div>
                    <details>
                      <summary>{fa ? "ویرایش کارت" : "Edit card"}</summary>
                      <BankEditor
                        locale={locale}
                        busy={busy}
                        initial={b}
                        onSave={(v) => save(`banks/${b.id}`, v)}
                      />
                    </details>
                  </section>
                ))}
              </div>
            </>
          )}
          {tab === "articles" &&
            rows.map((a) => (
              <div className="article-draft" key={`${a.id}-${a.locale}`}>
                <span className="pill">
                  {adminLabel(a.status, fa)} ·{" "}
                  {a.locale === "fa" ? "فارسی" : "English"}
                </span>
                <h3>{a.title}</h3>
                <details>
                  <summary>{fa ? "ویرایش مقاله" : "Edit article"}</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void save(
                        "articles",
                        {
                          slug: a.slug,
                          locale: a.locale,
                          title: f.get("title"),
                          description: f.get("description"),
                          body: withArticleCover(
                            String(f.get("body") || ""),
                            String(f.get("coverImage") || ""),
                            String(f.get("title") || ""),
                          ),
                        },
                        "POST",
                      );
                    }}
                  >
                    {["title", "description", "body"].map((key, i) => (
                      <div className="field" key={key}>
                        <label htmlFor={`edit-${a.id}-${a.locale}-${key}`}>
                          {
                            (fa
                              ? ["عنوان", "توضیح جستجو", "متن مقاله"]
                              : ["Title", "Description", "Body"])[i]
                          }
                        </label>
                        <textarea
                          id={`edit-${a.id}-${a.locale}-${key}`}
                          name={key}
                          defaultValue={String(a[key] || "")}
                          required={key !== "description"}
                          minLength={
                            key === "body" ? 20 : key === "title" ? 3 : 0
                          }
                          maxLength={
                            key === "body"
                              ? 100000
                              : key === "title"
                                ? 200
                                : 300
                          }
                        />
                      </div>
                    ))}
                    <ArticleImageField
                      fa={fa}
                      initialBody={String(a.body || "")}
                    />
                    <button className="button button-small" disabled={busy}>
                      {fa ? "ذخیره و انتشار" : "Save & publish"}
                    </button>
                  </form>
                </details>
                {a.status === "published" && (
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() =>
                      void save(`articles/${a.id}`, { status: "draft" })
                    }
                  >
                    {fa ? "توقف انتشار" : "Unpublish"}
                  </button>
                )}
                <details>
                  <summary>{fa ? "بررسی متن" : "Review content"}</summary>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 12,
                      marginTop: 15,
                    }}
                  >
                    {a.body}
                  </div>
                </details>
                {a.status !== "published" && (
                  <button
                    className="button button-small"
                    style={{ marginTop: 15 }}
                    disabled={busy}
                    onClick={() =>
                      void save(`articles/${a.id}`, { status: "published" })
                    }
                  >
                    {fa ? "انتشار مقاله" : "Publish article"}
                  </button>
                )}
                {a.status !== "archived" && (
                  <button
                    className="text-link"
                    style={{ marginInlineStart: 16 }}
                    disabled={busy}
                    onClick={() =>
                      void save(`articles/${a.id}`, { status: "archived" })
                    }
                  >
                    {fa
                      ? "حذف از سایت و بایگانی"
                      : "Remove from site & archive"}
                  </button>
                )}
              </div>
            ))}
        </>
      )}
    </div>
  );
}
function BankEditor({
  locale,
  busy,
  initial,
  onSave,
}: {
  locale: Locale;
  busy: boolean;
  initial?: Row;
  onSave: (v: unknown) => Promise<boolean>;
}) {
  const fa = locale === "fa";
  const [selectedBank, setSelectedBank] = useState(
    String(initial?.bankName || iranianBanks[0].name),
  );
  const [holder, setHolder] = useState(String(initial?.holderName || ""));
  const [number, setNumber] = useState(String(initial?.cardNumber || ""));
  return (
    <form
      className="content-panel bank-editor"
      style={{ marginBottom: 20 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const saved = await onSave({
          bankName: f.get("bankName"),
          holderName: f.get("holderName"),
          cardNumber: normalizeDigits(String(f.get("cardNumber"))).replace(
            /[\s-]/g,
            "",
          ),
          enabled: f.get("enabled") === "on",
          sortOrder: Number(f.get("sortOrder")),
        });
        if (saved && !initial) {
          form.reset();
          setHolder("");
          setNumber("");
          setSelectedBank(iranianBanks[0].name);
        }
      }}
    >
      <h2>
        {fa
          ? initial
            ? "ویرایش حساب بانکی"
            : "افزودن حساب بانکی"
          : initial
            ? "Edit bank account"
            : "Add bank account"}
      </h2>
      <div className="field">
        <label htmlFor={`bank-name-${initial?.id || "new"}`}>
          {fa ? "انتخاب بانک" : "Choose bank"}
        </label>
        <select
          name="bankName"
          id={`bank-name-${initial?.id || "new"}`}
          value={selectedBank}
          onChange={(e) => setSelectedBank(e.target.value)}
        >
          {initial?.bankName &&
            !iranianBanks.some((b) => b.name === initial.bankName) && (
              <option>{String(initial.bankName)}</option>
            )}
          {iranianBanks.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="bank-editor-preview">
        <BankCard
          locale={locale}
          bank={{
            bankName: selectedBank,
            holderName: holder,
            cardNumber: number,
          }}
        />
      </div>
      <div
        className="bank-choice-grid"
        role="group"
        aria-label={fa ? "بانک‌ها" : "Banks"}
      >
        {iranianBanks.map((b) => (
          <button
            type="button"
            key={b.id}
            aria-pressed={selectedBank === b.name}
            title={b.name}
            onClick={() => setSelectedBank(b.name)}
          >
            <BankLogo name={b.name} />
            <span>{b.name}</span>
          </button>
        ))}
      </div>
      {[
        ["holderName", "نام دارنده", "Cardholder name"],
        ["cardNumber", "شماره کارت ۱۶رقمی", "16-digit card number"],
        ["sortOrder", "ترتیب نمایش", "Display order"],
      ].map(([key, f, e]) => (
        <div className="field" key={key}>
          <label htmlFor={`${initial?.id || "new"}-${key}`}>{fa ? f : e}</label>
          <input
            name={key}
            onChange={(e) => {
              if (key === "holderName") setHolder(e.target.value);
              if (key === "cardNumber")
                setNumber(
                  normalizeDigits(e.target.value).replace(/[\s-]/g, ""),
                );
            }}
            id={`${initial?.id || "new"}-${key}`}
            defaultValue={String(
              initial?.[key] ?? (key === "sortOrder" ? 0 : ""),
            )}
            required
            type={key === "sortOrder" ? "number" : "text"}
            pattern={key === "cardNumber" ? "[0-9۰-۹٠-٩ -]{16,24}" : undefined}
            inputMode={key === "cardNumber" ? "numeric" : undefined}
            dir={key === "cardNumber" ? "ltr" : undefined}
          />
        </div>
      ))}
      <label className="checkbox">
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={initial ? !!initial.enabled : true}
        />
        {fa ? "نمایش برای پرداخت‌های جدید" : "Enable for new payments"}
      </label>
      <button className="button button-small" disabled={busy}>
        {fa ? "ذخیره حساب" : "Save account"}
      </button>
    </form>
  );
}
function tehranIso(value: string) {
  const initial = new Date(`${value}:00Z`);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const local = formatter.format(initial).replace(" ", "T") + "Z";
  return new Date(
    initial.getTime() - (new Date(local).getTime() - initial.getTime()),
  ).toISOString();
}
