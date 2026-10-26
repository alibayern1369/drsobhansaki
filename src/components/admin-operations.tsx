"use client";
import { useEffect, useState } from "react";
import { type Locale } from "@/lib/content";
import { Icon } from "./icon";
import { adminLabel, normalizeDigits } from "@/lib/admin-labels";
import { AdminAccountCreator } from "./admin-account-creator";
type Row = Record<string, string | number | boolean | null>;
type Collection = {
  slots?: Row[];
  availability?: Row[];
  blocked?: Row[];
  types?: Row[];
  templates?: Array<{
    key: string;
    content: { fa: string; en: string };
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
  const [busy, setBusy] = useState(false);
  const [smsKey, setSmsKey] = useState("booking_submitted");
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
                  <p>{row.name || row.phone}</p>
                  <p dir="ltr">{row.trackingCode}</p>
                  <time>
                    {new Date(String(row.createdAt)).toLocaleString(
                      fa ? "fa-IR" : "en-US",
                      { timeZone: "Asia/Tehran" },
                    )}
                  </time>
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
              {rows
                .filter((r) => `${r.name || ""}${r.phone}`.includes(search))
                .map((r) => (
                  <div
                    className="content-panel"
                    key={String(r.id)}
                    style={{
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <span className="small-icon">
                      <Icon name="user" />
                    </span>
                    <div>
                      <strong>
                        {r.name || (fa ? "نام ثبت نشده" : "Name not provided")}
                      </strong>
                      <p dir="ltr">{r.phone}</p>
                    </div>
                  </div>
                ))}
              {!rows.length && (
                <p>{fa ? "بیماری ثبت نشده است." : "No patients registered."}</p>
              )}
            </>
          )}
          {tab === "roles" && (
            <>
              <AdminAccountCreator
                locale={locale}
                onCreated={async () => {
                  const response = await fetch("/api/admin/roles");
                  if (response.ok) setData(await response.json());
                }}
              />
              {rows.map((r) => (
                <form
                  className="content-panel"
                  key={String(r.id)}
                  style={{ marginBottom: 15 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void save(`roles/${r.id}`, {
                      role: f.get("role"),
                      disabled: f.get("disabled") === "on",
                    });
                  }}
                >
                  <strong>{r.name || r.phone}</strong>
                  <div className="field">
                    <label htmlFor={`role-${r.id}`}>
                      {fa ? "نقش" : "Role"}
                    </label>
                    <select
                      id={`role-${r.id}`}
                      name="role"
                      disabled={r.id === currentUserId}
                      defaultValue={String(r.role)}
                    >
                      {[
                        ["patient", "بیمار", "Patient"],
                        ["staff", "کارمند مجاز", "Authorized staff"],
                        ["doctor", "پزشک", "Doctor"],
                        ["super_admin", "مدیر کل", "Super administrator"],
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
                      name="disabled"
                      disabled={r.id === currentUserId}
                      defaultChecked={!!r.disabled}
                    />
                    {fa ? "غیرفعال کردن حساب" : "Disable account"}
                  </label>
                  <button
                    className="button button-small"
                    disabled={busy || r.id === currentUserId}
                  >
                    {fa
                      ? "ذخیره و لغو نشست‌های قبلی"
                      : "Save & revoke existing sessions"}
                  </button>
                </form>
              ))}
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
                    ? "بازهٔ کاری را وارد کنید؛ زمان‌ها با مدت مشاوره و فاصلهٔ بین نوبت‌ها ساخته می‌شوند. تاریخ بر اساس تقویم میلادی و ساعت تهران است."
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
                  <input id="batch-date" name="date" type="date" required />
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
                      <input id={`batch-${k}`} name={k} type="time" required />
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
                      <input
                        type="datetime-local"
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
                      <input
                        type="datetime-local"
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
                  <strong>
                    {new Date(String(s.startsAt)).toLocaleString(
                      fa ? "fa-IR" : "en-US",
                      { timeZone: "Asia/Tehran" },
                    )}
                  </strong>
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
                    {new Date(String(row.startsAt)).toLocaleString(
                      fa ? "fa-IR" : "en-US",
                      { timeZone: "Asia/Tehran" },
                    )}{" "}
                    —{" "}
                    {new Date(String(row.endsAt)).toLocaleString(
                      fa ? "fa-IR" : "en-US",
                      { timeZone: "Asia/Tehran" },
                    )}
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
              <form
                className="content-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void save("sms", {
                    key: f.get("key"),
                    content: { fa: f.get("fa"), en: f.get("en") },
                    enabled: f.get("enabled") === "on",
                  });
                }}
              >
                <h2>{fa ? "قالب پیامک" : "SMS template"}</h2>
                <div className="notice" style={{ marginBottom: 20 }}>
                  {fa
                    ? "اطلاعات پزشکی حساس را در پیامک درج نکنید. ارسال با صف اعلان و سرویس تنظیم‌شده انجام می‌شود."
                    : "Do not include sensitive medical information in SMS. Delivery uses the outbox and configured provider."}
                </div>
                <div className="field">
                  <label htmlFor="sms-key">{fa ? "رویداد" : "Event"}</label>
                  <select
                    id="sms-key"
                    name="key"
                    value={smsKey}
                    onChange={(e) => setSmsKey(e.target.value)}
                  >
                    {[
                      "booking_submitted",
                      "receipt_submitted",
                      "payment_approved",
                      "payment_rejected",
                      "payment_additional_information_required",
                      "appointment_confirmed",
                      "appointment_cancelled",
                      "appointment_reminder",
                    ].map((v) => (
                      <option key={v} value={v}>
                        {adminLabel(v, fa)}
                      </option>
                    ))}
                  </select>
                </div>
                {(["fa", "en"] as const).map((l) => (
                  <div className="field" key={l}>
                    <label htmlFor={`sms-${l}`}>
                      {l === "fa" ? "متن فارسی" : "English text"}
                    </label>
                    <textarea
                      key={`${smsKey}-${l}-${collection.templates?.find((t) => t.key === smsKey)?.content[l] || ""}`}
                      defaultValue={
                        collection.templates?.find((t) => t.key === smsKey)
                          ?.content[l] || ""
                      }
                      id={`sms-${l}`}
                      name={l}
                      dir={l === "fa" ? "rtl" : "ltr"}
                      required
                      maxLength={500}
                    />
                  </div>
                ))}
                <label className="checkbox">
                  <input
                    key={`${smsKey}-${collection.templates?.find((t) => t.key === smsKey)?.enabled}`}
                    type="checkbox"
                    name="enabled"
                    defaultChecked={
                      collection.templates?.find((t) => t.key === smsKey)
                        ?.enabled ?? true
                    }
                  />
                  {fa ? "فعال" : "Enabled"}
                </label>
                <button className="button button-small" disabled={busy}>
                  {fa ? "ذخیره قالب" : "Save template"}
                </button>
              </form>
              <h2 style={{ fontSize: 21, margin: "25px 0 15px" }}>
                {fa ? "گزارش تحویل" : "Delivery log"}
              </h2>
              {collection.deliveries?.map((n) => (
                <div key={String(n.id)} className="summary-line">
                  <span>
                    {adminLabel(n.event, fa)} · {adminLabel(n.status, fa)} ·{" "}
                    {n.attempts}
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
              <h2 style={{ fontSize: 21, margin: "25px 0 15px" }}>
                {fa ? "قالب‌های ذخیره‌شده" : "Saved templates"}
              </h2>
              {collection.templates?.map((t) => (
                <details className="article-draft" key={t.key}>
                  <summary>{adminLabel(t.key, fa)}</summary>
                  <p>{t.content.fa}</p>
                  <p dir="ltr">{t.content.en}</p>
                </details>
              ))}
            </>
          )}
          {tab === "banks" && (
            <>
              <BankEditor
                locale={locale}
                busy={busy}
                onSave={(v) => save("banks", v, "POST")}
              />
              {rows.map((b) => (
                <BankEditor
                  key={String(b.id)}
                  locale={locale}
                  busy={busy}
                  initial={b}
                  onSave={(v) => save(`banks/${b.id}`, v)}
                />
              ))}
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
                          body: f.get("body"),
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
                    <button className="button button-small" disabled={busy}>
                      {fa ? "ذخیره به‌صورت پیش‌نویس" : "Save as draft"}
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
                {(!a.approvedAt || a.status !== "published") && (
                  <button
                    className="button button-small"
                    style={{ marginTop: 15 }}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          fa
                            ? "آیا صحت علمی این متن و ترجمهٔ همین زبان را بررسی کرده‌اید و انتشار را تأیید می‌کنید؟"
                            : "Have you medically reviewed this text and its translation for this locale, and approved publication?",
                        )
                      )
                        void save(
                          `articles/${a.id}/approve`,
                          { locale: a.locale },
                          "POST",
                        );
                    }}
                  >
                    {fa
                      ? "تأیید علمی و انتشار این زبان"
                      : "Approve & publish this language"}
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
  return (
    <form
      className="content-panel"
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
        if (saved && !initial) form.reset();
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
      {[
        ["bankName", "نام بانک", "Bank name"],
        ["holderName", "نام دارنده", "Cardholder name"],
        ["cardNumber", "شماره کارت ۱۶رقمی", "16-digit card number"],
        ["sortOrder", "ترتیب نمایش", "Display order"],
      ].map(([key, f, e]) => (
        <div className="field" key={key}>
          <label htmlFor={`${initial?.id || "new"}-${key}`}>{fa ? f : e}</label>
          <input
            name={key}
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
          defaultChecked={!!initial?.enabled}
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
