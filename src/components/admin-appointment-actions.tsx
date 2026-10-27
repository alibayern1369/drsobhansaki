"use client";
import Image from "next/image";
import { formatJalali } from "@/lib/jalali";
import { useState } from "react";
import { type Locale } from "@/lib/content";
import { ReceiptRetentionControls } from "./receipt-storage-settings";
import { adminLabel } from "@/lib/admin-labels";
export function AdminAppointmentActions({
  locale,
  id,
  consultationTypeId,
  status,
  onChange,
}: {
  locale: Locale;
  id: string;
  consultationTypeId: string;
  status: string;
  onChange: () => Promise<void>;
}) {
  const fa = locale === "fa";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipts, setReceipts] = useState<
    {
      id: string;
      scanStatus: string;
      mimeType: string;
      retentionHold: boolean;
      legalRetentionHold: boolean;
      disputeActive: boolean;
      legalRetentionUntil: string | null;
      uploadedAt: string;
      transactionReference: string | null;
    }[]
  >([]);
  const [slots, setSlots] = useState<
    {
      id: string;
      startsAt: string;
      consultationTypeId: string;
      enabled: boolean;
    }[]
  >([]);
  const [slot, setSlot] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<
    {
      id: string;
      toState: string;
      note: string | null;
      createdAt: string;
      actorName: string | null;
      actorRole: string;
    }[]
  >([]);
  async function call(path: string, value: unknown) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/appointments/${id}/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify(value),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setMessage(fa ? "انجام شد." : "Done.");
      await onChange();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function details() {
    setBusy(true);
    try {
      const [r, c, h] = await Promise.all([
        fetch(`/api/admin/payment-details/${id}`, {
          headers: { "Accept-Language": locale },
        }),
        fetch("/api/admin/calendar", {
          headers: { "Accept-Language": locale },
        }),
        fetch(`/api/admin/appointment-history/${id}`, {
          headers: { "Accept-Language": locale },
        }),
      ]);
      const [rd, cd] = await Promise.all([r.json(), c.json()]);
      if (!r.ok) throw new Error(rd.message);
      if (!c.ok) throw new Error(cd.message);
      const hd = await h.json();
      if (!h.ok) throw new Error(hd.message);
      setHistory(hd);
      setLoaded(true);
      setReceipts(rd);
      setSlots(cd.slots || []);
      setMessage(fa ? "جزئیات دریافت شد." : "Details loaded.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ marginTop: 20 }}>
      <button
        className="text-link"
        style={{ background: "none" }}
        disabled={busy}
        onClick={details}
      >
        {fa ? "رسیدها و زمان‌بندی" : "Receipts & scheduling"}
      </button>
      {receipts.map((r) => (
        <div key={r.id}>
          <p>
            {fa ? "تاریخ بارگذاری:" : "Uploaded:"}{" "}
            {formatJalali(r.uploadedAt, true)} ·{" "}
            {fa ? "شماره تراکنش:" : "Bank reference:"}{" "}
            <b dir="ltr">{r.transactionReference || "—"}</b>
          </p>
          <div className="summary-line">
            <span>
              {fa ? "رسید پرداخت" : "Payment receipt"} ·{" "}
              {adminLabel(r.scanStatus, fa)}
            </span>
            <a
              className="text-link"
              href={`/api/receipts/${r.id}/download?view=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {fa
                ? r.mimeType === "application/pdf"
                  ? "مشاهده فایل PDF"
                  : "مشاهده رسید در اندازه کامل"
                : "Open full receipt"}
            </a>{" "}
          </div>
          {r.mimeType?.startsWith("image/") && (
            <a
              href={`/api/receipts/${r.id}/download?view=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                unoptimized
                width={800}
                height={1000}
                className="receipt-preview"
                src={`/api/receipts/${r.id}/download?view=1`}
                alt={fa ? "رسید ارسالی بیمار" : "Patient payment receipt"}
                loading="lazy"
              />
            </a>
          )}
          <ReceiptRetentionControls
            receiptId={r.id}
            locale={locale}
            initial={r}
          />
        </div>
      ))}
      {loaded && !receipts.length && (
        <p className="notice">
          {fa
            ? "هنوز رسیدی برای این نوبت ارسال نشده است."
            : "No receipt has been submitted for this appointment."}
        </p>
      )}
      {loaded && history.length > 0 && (
        <details className="appointment-timeline">
          <summary>
            {fa ? "تاریخچه بررسی و وضعیت" : "Review and status history"}
          </summary>
          <ol>
            {history.map((h) => (
              <li key={h.id}>
                <strong>{adminLabel(h.toState, fa)}</strong>
                <small>
                  {formatJalali(h.createdAt, true)} ·{" "}
                  {h.actorName || adminLabel(h.actorRole, fa)}
                </small>
                {h.note && <p>{h.note}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
      {["awaiting_scheduling", "confirmed"].includes(status) &&
        slots.length > 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void call("schedule", { slotId: slot });
            }}
            style={{ marginTop: 20 }}
          >
            <div className="field">
              <label htmlFor={`assign-${id}`}>
                {fa
                  ? "تعیین یا تغییر زمان (تهران)"
                  : "Assign or reschedule (Tehran)"}
              </label>
              <select
                id={`assign-${id}`}
                required
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
              >
                <option value="">{fa ? "انتخاب زمان" : "Choose time"}</option>
                {slots
                  .filter(
                    (s) =>
                      s.enabled && s.consultationTypeId === consultationTypeId,
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatJalali(s.startsAt, true)}
                    </option>
                  ))}
              </select>
            </div>
            <button className="button button-small" disabled={busy}>
              {fa ? "تأیید زمان" : "Confirm time"}
            </button>
          </form>
        )}
      <div
        style={{ display: "flex", gap: 12, marginTop: 15, flexWrap: "wrap" }}
      >
        {status === "confirmed" && (
          <button
            className="button button-small"
            disabled={busy}
            onClick={() => call("status", { status: "in_progress" })}
          >
            {fa ? "شروع مشاوره" : "Start consultation"}
          </button>
        )}
        {status === "in_progress" && (
          <button
            className="button button-small"
            disabled={busy}
            onClick={() => call("status", { status: "completed" })}
          >
            {fa ? "پایان مشاوره" : "Complete consultation"}
          </button>
        )}
        {[
          "awaiting_payment",
          "awaiting_verification",
          "awaiting_scheduling",
          "confirmed",
        ].includes(status) && (
          <button
            className="text-link"
            style={{ background: "none" }}
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  fa
                    ? "نوبت لغو شود؟ استرداد وجه، اقدام جداگانه‌ای است."
                    : "Cancel this appointment? Any refund is a separate action.",
                )
              )
                void call("status", { status: "cancelled" });
            }}
          >
            {fa ? "لغو نوبت" : "Cancel appointment"}
          </button>
        )}
      </div>
      {message && (
        <p className="notice" role="status" style={{ marginTop: 15 }}>
          {message}
        </p>
      )}
    </div>
  );
}
