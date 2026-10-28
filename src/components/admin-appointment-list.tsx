"use client";
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/content";
import { formatMoney } from "@/lib/domain";
import { formatJalali } from "@/lib/jalali";
import { statusLabel, appointmentTone } from "@/lib/patient-portal";
import { JalaliDatePicker } from "./jalali-date-picker";
import { AdminAppointmentActions } from "./admin-appointment-actions";
import { formatPhone } from "@/lib/phone-display";
type Item = {
  id: string;
  trackingCode: string;
  patientName: string | null;
  patientPhone: string;
  status: string;
  paymentStatus: string;
  priceRial: number;
  startsAt: string | null;
  consultationTypeId: string;
  typeSnapshot: { key: string };
};
export function AdminAppointmentList({
  locale,
  role,
  revision,
  onChanged,
}: {
  locale: Locale;
  role: string;
  revision?: unknown;
  onChanged?: () => Promise<void>;
}) {
  const fa = locale === "fa";
  const [items, setItems] = useState<Item[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1);
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
        `/api/admin/appointment-list?${new URLSearchParams({ page: String(page), q: query, status, from, to })}`,
        { headers: { "Accept-Language": locale } },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, query, status, from, to, locale]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return load();
    });
    return () => {
      active = false;
    };
  }, [load, revision]);
  const refresh = async () => {
    if (onChanged) await onChanged();
    else await load();
  };
  return (
    <>
      <p className="notice">
        {fa
          ? "رسید ارسالی را در جزئیات مشاهده کنید و واریز را مستقلاً در بانک تطبیق دهید. تأیید واریز، نوبت دارای زمان را قطعی می‌کند. رد یا درخواست اصلاح نیازمند دلیل است. بیمار می‌تواند برای همان نوبت رسید جدید بفرستد."
          : "Inspect the receipt and independently verify the bank deposit. Approval confirms a scheduled appointment. Rejection or corrections require a reason. Patients may resubmit for the same appointment."}
      </p>
      <form
        className="portal-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
          setPage(1);
        }}
      >
        <div className="field">
          <label htmlFor="appointment-search">
            {fa ? "نام، موبایل یا کد پیگیری" : "Name, mobile or tracking code"}
          </label>
          <input
            id="appointment-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="appointment-filter">{fa ? "وضعیت" : "Status"}</label>
          <select
            id="appointment-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
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
            ].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="appointment-from">
            {fa ? "زمان نوبت از" : "Appointment from"}
          </label>
          <JalaliDatePicker
            id="appointment-from"
            value={from}
            onChange={(v) => {
              setFrom(v);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="appointment-to">{fa ? "تا" : "To"}</label>
          <JalaliDatePicker
            id="appointment-to"
            value={to}
            onChange={(v) => {
              setTo(v);
              setPage(1);
            }}
          />
        </div>
        <button className="button button-small">
          {fa ? "جست‌وجو" : "Search"}
        </button>
        <button
          className="text-link"
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {fa ? "به‌روزرسانی فهرست" : "Refresh list"}
        </button>
        <button
          className="text-link"
          type="button"
          onClick={() => {
            setFrom("");
            setTo("");
            setStatus("");
            setSearch("");
            setQuery("");
            setPage(1);
          }}
        >
          {fa ? "پاک‌کردن فیلترها" : "Clear filters"}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
          <button onClick={() => void load()}>
            {fa ? "تلاش مجدد" : "Retry"}
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">
          {fa ? "در حال دریافت نوبت‌ها…" : "Loading appointments…"}
        </p>
      ) : items.length ? (
        items.map((a) => (
          <article key={a.id} className="content-panel patient-appointment">
            <div className="appointment-card-heading">
              <h2>{a.patientName || (fa ? "بیمار" : "Patient")}</h2>
              <span className={`appointment-status ${appointmentTone(a)}`}>
                {statusLabel(a.status, locale)} /{" "}
                {statusLabel(a.paymentStatus, locale)}
              </span>
            </div>
            <p dir="ltr">
              <bdi dir="ltr">{formatPhone(a.patientPhone)}</bdi> ·{" "}
              <bdi dir="ltr">{a.trackingCode}</bdi>
            </p>
            <p>
              {a.typeSnapshot.key === "phone"
                ? fa
                  ? "مشاوره تلفنی"
                  : "Telephone"
                : fa
                  ? "مشاوره متنی"
                  : "Text"}{" "}
              · {formatMoney(a.priceRial, locale)} ·{" "}
              {a.startsAt
                ? formatJalali(a.startsAt, true)
                : fa
                  ? "بدون زمان"
                  : "Unscheduled"}
            </p>
            {role !== "staff" && (
              <>
                <AdminAppointmentActions
                  locale={locale}
                  id={a.id}
                  consultationTypeId={a.consultationTypeId}
                  status={a.status}
                  onChange={refresh}
                />
                {a.paymentStatus === "under_review" && (
                  <PaymentReview id={a.id} locale={locale} onChange={refresh} />
                )}
              </>
            )}
          </article>
        ))
      ) : (
        <p className="empty-state">
          {fa
            ? "نوبتی برای این جست‌وجو وجود ندارد."
            : "No appointments match these filters."}
        </p>
      )}
      <nav
        className="portal-pagination"
        aria-label={fa ? "صفحات نوبت‌ها" : "Appointment pages"}
      >
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          {fa ? "قبلی" : "Previous"}
        </button>
        <span>
          {page.toLocaleString(locale)} /{" "}
          {Math.max(1, Math.ceil(total / 15)).toLocaleString(locale)}
        </span>
        <button
          disabled={page * 15 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          {fa ? "بعدی" : "Next"}
        </button>
      </nav>
    </>
  );
}
function PaymentReview({
  id,
  locale,
  onChange,
}: {
  id: string;
  locale: Locale;
  onChange: () => Promise<void>;
}) {
  const fa = locale === "fa";
  const [note, setNote] = useState(""),
    [verified, setVerified] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [keys] = useState(() => ({
    approve: crypto.randomUUID(),
    reject: crypto.randomUUID(),
    request_information: crypto.randomUUID(),
  }));
  async function review(action: keyof typeof keys) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/appointments/${id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify({
          action,
          note,
          bankDepositVerified: verified,
          idempotencyKey: keys[action],
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="payment-review">
      <div className="field">
        <label htmlFor={`review-note-${id}`}>
          {fa
            ? "توضیح بررسی (برای رد یا اصلاح الزامی)"
            : "Review note (required for rejection or corrections)"}
        </label>
        <textarea
          id={`review-note-${id}`}
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
        />
        {fa
          ? "واریز را مستقلاً در حساب بانکی بررسی و تطبیق داده‌ام."
          : "I independently verified and matched this deposit in the bank account."}
      </label>
      <div className="portal-actions">
        <button
          className="button button-small"
          disabled={busy || !verified}
          onClick={() => void review("approve")}
        >
          {fa ? "تأیید واریز و نوبت" : "Approve deposit & appointment"}
        </button>
        <button
          className="button button-small button-white"
          disabled={busy || note.trim().length < 3}
          onClick={() => void review("reject")}
        >
          {fa ? "رد رسید با دلیل" : "Reject with reason"}
        </button>
        <button
          className="text-link"
          disabled={busy || note.trim().length < 3}
          onClick={() => void review("request_information")}
        >
          {fa ? "درخواست اصلاح رسید" : "Request correction"}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
