"use client";
import { formatJalali } from "@/lib/jalali";
import { JalaliDatePicker } from "./jalali-date-picker";
import { useEffect, useState } from "react";
import { type Locale } from "@/lib/content";
import {
  DEFAULT_RECEIPT_POLICY,
  type ReceiptPolicy,
} from "@/lib/receipt-policy";
type Overview = {
  policy: ReceiptPolicy;
  deletionInterlockEnabled: boolean;
  blobConfigured: boolean;
  trackedBytes: number;
  trackedFiles: number;
  lastRun: {
    startedAt: string;
    deleted: number;
    errors: number;
    dryRun: boolean;
    status: string;
  } | null;
};
export function ReceiptStorageSettings({ locale }: { locale: Locale }) {
  const fa = locale === "fa";
  const [data, setData] = useState<Overview | null>(null);
  const [policy, setPolicy] = useState<ReceiptPolicy>(DEFAULT_RECEIPT_POLICY);
  const [ack, setAck] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{
    scanned: number;
    eligible: number;
    deleted: number;
    errors: number;
    dryRun: boolean;
    status: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/receipt-storage", {
      headers: { "Accept-Language": locale },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        if (active) {
          setData(d);
          setPolicy(d.policy);
        }
      })
      .catch((e) => setMessage(e.message));
    return () => {
      active = false;
    };
  }, [locale]);
  async function send(method: "PUT" | "POST") {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/receipt-storage", {
        method,
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body:
          method === "PUT"
            ? JSON.stringify({ ...policy, approvalAcknowledged: ack })
            : "{}",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      if (method === "POST") setPreview(d);
      setMessage(
        fa
          ? method === "PUT"
            ? "ذخیره شد. حذف واقعی به کلید اجرایی Vercel نیز نیاز دارد."
            : "پیش‌نمایش انجام شد؛ هیچ فایلی حذف نشد."
          : method === "PUT"
            ? "Saved. Live deletion also requires the Vercel execution interlock."
            : "Dry-run complete. No files were deleted.",
      );
      const updated = await fetch("/api/admin/receipt-storage", {
        headers: { "Accept-Language": locale },
      });
      if (updated.ok) setData(await updated.json());
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {message && (
        <div className="notice" role="status" style={{ marginBottom: 20 }}>
          {message}
        </div>
      )}
      <div className="stats-grid">
        {[
          {
            label: fa ? "اتصال خصوصی" : "Private connection",
            value: data?.blobConfigured
              ? fa
                ? "تنظیم‌شده"
                : "Configured"
              : fa
                ? "توکن لازم است"
                : "Token required",
          },
          {
            label: fa ? "فایل‌های ثبت‌شده" : "Tracked files",
            value: data?.trackedFiles ?? "—",
          },
          {
            label: fa ? "حجم ثبت‌شده (MB)" : "Tracked size (MB)",
            value: data ? (data.trackedBytes / 1048576).toFixed(2) : "—",
          },
          {
            label: fa ? "حذف در آخرین اجرا" : "Deleted in last run",
            value: data?.lastRun?.deleted ?? 0,
          },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <span>{s.label}</span>
            <strong style={{ fontSize: 18 }}>{s.value}</strong>
          </div>
        ))}
      </div>
      <form
        className="content-panel"
        onSubmit={(e) => {
          e.preventDefault();
          void send("PUT");
        }}
      >
        <h2>{fa ? "سیاست نگهداری رسیدها" : "Receipt retention policy"}</h2>
        <div className="notice warn">
          {fa
            ? "حداقل نگهداری ۷ روز کامل است. الزامات قانونی و حسابداری باید جداگانه بررسی و سیاست توسط مدیر کل تأیید شود. پیش‌نمایش هیچ فایلی حذف نمی‌کند."
            : "At least seven full days are required. Legal/accounting requirements must be reviewed and the policy approved by a super administrator. Preview never deletes files."}
        </div>
        <div className="two-cols" style={{ marginTop: 20 }}>
          <div className="field">
            <label htmlFor="receipt-days">
              {fa ? "مدت نگهداری (روز)" : "Retention days"}
            </label>
            <input
              id="receipt-days"
              type="number"
              min={7}
              max={3650}
              required
              value={policy.retentionDays}
              onChange={(e) =>
                setPolicy({ ...policy, retentionDays: Number(e.target.value) })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="receipt-legal-days">
              {fa
                ? "حداقل قانونی/حسابداری بررسی‌شده"
                : "Reviewed legal/accounting minimum"}
            </label>
            <input
              id="receipt-legal-days"
              type="number"
              min={7}
              max={3650}
              value={policy.mandatoryRetentionDays ?? ""}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  mandatoryRetentionDays: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
            />
          </div>
        </div>
        {[
          {
            key: "enabled" as const,
            label: fa ? "اجرای روزانه فعال باشد" : "Enable daily cleanup",
          },
          {
            key: "dryRun" as const,
            label: fa
              ? "حالت آزمایشی؛ بدون حذف فایل"
              : "Dry-run without file deletion",
          },
          {
            key: "policyApproved" as const,
            label: fa
              ? "سیاست تأییدشده توسط مدیر کل"
              : "Policy approved by super administrator",
          },
        ].map((f) => (
          <label className="checkbox" key={f.key}>
            <input
              type="checkbox"
              checked={policy[f.key]}
              onChange={(e) =>
                setPolicy({ ...policy, [f.key]: e.target.checked })
              }
            />
            {f.label}
          </label>
        ))}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          {fa
            ? "الزامات قانونی و مالی این سیاست را بررسی و تأیید می‌کنم."
            : "I have reviewed and approved the legal and accounting requirements."}
        </label>
        <p style={{ fontSize: 11 }}>
          {fa ? "کلید اجرایی حذف در Vercel: " : "Vercel deletion interlock: "}
          {data?.deletionInterlockEnabled
            ? fa
              ? "فعال"
              : "enabled"
            : fa
              ? "غیرفعال؛ حذف واقعی انجام نمی‌شود"
              : "disabled; no live deletion"}
        </p>
        <div
          style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}
        >
          <button className="button button-small" disabled={busy || !data}>
            {fa ? "ذخیره سیاست" : "Save policy"}
          </button>
          <button
            type="button"
            className="button button-small button-white"
            style={{ borderColor: "#ddd" }}
            disabled={busy || !data}
            onClick={() => send("POST")}
          >
            {fa ? "پیش‌نمایش امن پاک‌سازی" : "Preview cleanup safely"}
          </button>
        </div>
      </form>
      {data?.lastRun && (
        <div className="content-panel" style={{ marginTop: 20 }}>
          <h2>{fa ? "آخرین اجرای پاک‌سازی" : "Last cleanup execution"}</h2>
          <p>{formatJalali(data.lastRun.startedAt, true)}</p>
          <p>
            {fa ? "خطاها: " : "Errors: "}
            {data.lastRun.errors} · {data.lastRun.status} ·{" "}
            {data.lastRun.dryRun ? "dry-run" : "live"}
          </p>
        </div>
      )}
      {preview !== null && (
        <div className="content-panel" style={{ marginTop: 20 }}>
          <h2>{fa ? "نتیجهٔ پیش‌نمایش" : "Preview result"}</h2>
          {[
            [fa ? "فایل‌های بررسی‌شده" : "Files scanned", preview.scanned],
            [fa ? "واجد شرایط" : "Eligible", preview.eligible],
            [fa ? "حذف‌شده" : "Deleted", preview.deleted],
            [fa ? "خطاها" : "Errors", preview.errors],
          ].map(([label, count]) => (
            <div className="summary-line" key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
          <p>
            {fa
              ? "این اجرا صرفاً پیش‌نمایش است و فایلی حذف نمی‌کند."
              : "This is a preview; no files are deleted."}
          </p>
        </div>
      )}
    </div>
  );
}
export function ReceiptRetentionControls({
  receiptId,
  locale,
  initial,
}: {
  receiptId: string;
  locale: Locale;
  initial: {
    retentionHold?: boolean;
    legalRetentionHold?: boolean;
    disputeActive?: boolean;
    legalRetentionUntil?: string | null;
  };
}) {
  const fa = locale === "fa";
  const [values, setValues] = useState({
    retentionHold: !!initial.retentionHold,
    legalRetentionHold: !!initial.legalRetentionHold,
    disputeActive: !!initial.disputeActive,
  });
  const [until, setUntil] = useState(
    initial.legalRetentionUntil?.slice(0, 10) || "",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="article-draft" style={{ marginTop: 10 }}>
      <summary>
        {fa ? "توقف حذف / اختلاف پرداخت" : "Retention holds / dispute"}
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch(
              `/api/admin/receipts/${receiptId}/retention`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "Accept-Language": locale,
                },
                body: JSON.stringify({
                  ...values,
                  legalRetentionUntil: until ? `${until}T23:59:59Z` : null,
                }),
              },
            );
            const d = await r.json();
            setMessage(r.ok ? (fa ? "ذخیره شد." : "Saved.") : d.message);
          } catch {
            setMessage(fa ? "ارتباط برقرار نشد." : "Connection failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          {
            key: "retentionHold" as const,
            label: fa ? "توقف دستی حذف" : "Manual retention hold",
          },
          {
            key: "legalRetentionHold" as const,
            label: fa
              ? "نیاز قانونی/حسابداری به نگهداری"
              : "Legal/accounting hold",
          },
          {
            key: "disputeActive" as const,
            label: fa ? "اختلاف پرداخت فعال است" : "Payment dispute active",
          },
        ].map((f) => (
          <label className="checkbox" key={f.key}>
            <input
              type="checkbox"
              checked={values[f.key]}
              onChange={(e) =>
                setValues({ ...values, [f.key]: e.target.checked })
              }
            />
            {f.label}
          </label>
        ))}
        <div className="field">
          <label htmlFor={`retain-${receiptId}`}>
            {fa
              ? "نگهداری اجباری تا پایان روز (UTC)"
              : "Mandatory retention through end of day (UTC)"}
          </label>
          <JalaliDatePicker
            id={`retain-${receiptId}`}
            value={until}
            onChange={setUntil}
          />
        </div>
        <button className="button button-small" disabled={busy}>
          {fa ? "ذخیره محدودیت نگهداری" : "Save retention restrictions"}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
