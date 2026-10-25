"use client";
import { useState } from "react";
import { type Locale } from "@/lib/content";
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
    { id: string; scanStatus: string }[]
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
  const [url, setUrl] = useState("");
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
    try {
      const [r, c] = await Promise.all([
        fetch(`/api/admin/payment-details/${id}`, {
          headers: { "Accept-Language": locale },
        }),
        fetch("/api/admin/calendar", {
          headers: { "Accept-Language": locale },
        }),
      ]);
      const [rd, cd] = await Promise.all([r.json(), c.json()]);
      if (!r.ok) throw new Error(rd.message);
      if (!c.ok) throw new Error(cd.message);
      setReceipts(rd);
      setSlots(cd.slots || []);
      setMessage(fa ? "جزئیات دریافت شد." : "Details loaded.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <div style={{ marginTop: 20 }}>
      <button
        className="text-link"
        style={{ background: "none" }}
        onClick={details}
      >
        {fa ? "رسیدها و زمان‌بندی" : "Receipts & scheduling"}
      </button>
      {receipts.map((r) => (
        <div className="summary-line" key={r.id}>
          <span>
            {fa ? "رسید پرداخت" : "Payment receipt"} · {r.scanStatus}
          </span>
          <button
            className="text-link"
            style={{ background: "none" }}
            onClick={async () => {
              try {
                const res = await fetch(`/api/receipts/${r.id}`, {
                  headers: { "Accept-Language": locale },
                });
                const d = await res.json();
                if (!res.ok) throw new Error(d.message);
                setUrl(d.url);
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            {fa ? "دریافت لینک موقت" : "Get temporary link"}
          </button>
        </div>
      ))}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="button button-small"
          style={{ marginTop: 10 }}
        >
          {fa
            ? "دانلود رسید (اعتبار ۶۰ ثانیه)"
            : "Download receipt (valid for 60 seconds)"}
        </a>
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
                      {new Date(s.startsAt).toLocaleString(
                        fa ? "fa-IR" : "en-US",
                        { timeZone: "Asia/Tehran" },
                      )}
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
