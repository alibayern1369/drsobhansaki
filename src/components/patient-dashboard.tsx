"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { copy, type Locale } from "@/lib/content";
import { formatMoney } from "@/lib/domain";
import { Icon } from "./icon";
import { upload } from "@vercel/blob/client";
import { MAX_RECEIPT_BYTES, RECEIPT_MIME_TYPES } from "@/lib/receipt-policy";
import { PatientReceipts } from "./patient-receipts";
type Appointment = {
  id: string;
  trackingCode: string;
  status: string;
  paymentStatus: string;
  priceRial: number;
  typeSnapshot: { key: string };
  slotId: string | null;
  createdAt: string;
  startsAt: string | null;
};
export function PatientDashboard({ locale }: { locale: Locale }) {
  const fa = locale === "fa";
  const t = copy[locale];
  const [items, setItems] = useState<Appointment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/appointments", { headers: { "Accept-Language": locale } })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        setItems(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [locale]);
  async function request(id: string, kind: string) {
    try {
      const r = await fetch(`/api/appointments/${id}/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify({ kind }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setMessage(
        fa
          ? "درخواست برای بررسی ثبت شد."
          : "Your request has been submitted for review.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div>
      <div className="dashboard-title">
        <h1>{t.patient}</h1>
        <Link href={`/${locale}/booking`} className="button button-small">
          {t.book}
          <Icon name="plus" size={16} />
        </Link>
      </div>
      <div className="stats-grid">
        {(fa
          ? [
              "همهٔ نوبت‌ها",
              "نوبت‌های تأییدشده",
              "در انتظار بررسی",
              "مشاوره‌های انجام‌شده",
            ]
          : ["All appointments", "Confirmed", "Awaiting review", "Completed"]
        ).map((label, i) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>
              {new Intl.NumberFormat(locale).format(
                items.filter(
                  (a) =>
                    i === 0 ||
                    a.status ===
                      ["", "confirmed", "awaiting_verification", "completed"][
                        i
                      ],
                ).length,
              )}
            </strong>
          </div>
        ))}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="form-success" role="status">
          {message}
        </div>
      )}
      {loading ? (
        <p>{fa ? "در حال دریافت نوبت‌ها…" : "Loading appointments…"}</p>
      ) : !items.length ? (
        <div className="empty-state">
          <span className="small-icon">
            <Icon name="calendar" />
          </span>
          <h2>{fa ? "هنوز نوبتی ثبت نشده است" : "No appointments yet"}</h2>
          <p>
            {fa
              ? "نوبت‌های شما و وضعیت بررسی پرداخت در این بخش نمایش داده می‌شوند."
              : "Your appointments and payment verification status will appear here."}
          </p>
        </div>
      ) : (
        items.map((a) => (
          <div
            className="content-panel"
            key={a.id}
            style={{ marginBottom: 20 }}
          >
            <h2 style={{ fontSize: 18 }}>
              {a.typeSnapshot.key === "phone" ? t.phone : t.text}
            </h2>
            <div className="summary-line">
              <span>{fa ? "کد پیگیری" : "Tracking code"}</span>
              <strong dir="ltr">{a.trackingCode}</strong>
            </div>
            <div className="summary-line">
              <span>{fa ? "وضعیت نوبت" : "Appointment status"}</span>
              <strong>{statusLabel(a.status, locale)}</strong>
            </div>
            <div className="summary-line">
              <span>{fa ? "وضعیت پرداخت" : "Payment status"}</span>
              <strong>{statusLabel(a.paymentStatus, locale)}</strong>
            </div>
            {a.startsAt &&
              ["confirmed", "in_progress", "completed"].includes(a.status) && (
                <div className="summary-line">
                  <span>
                    {fa ? "زمان قطعی (تهران)" : "Confirmed time (Tehran)"}
                  </span>
                  <strong>
                    {new Date(a.startsAt).toLocaleString(
                      fa ? "fa-IR" : "en-US",
                      {
                        timeZone: "Asia/Tehran",
                        dateStyle: "long",
                        timeStyle: "short",
                      },
                    )}
                  </strong>
                </div>
              )}
            <div className="summary-line">
              <span>{fa ? "تعرفه توافق‌شده" : "Agreed price"}</span>
              <strong>{formatMoney(a.priceRial, locale)}</strong>
            </div>
            {[
              "awaiting_payment",
              "rejected",
              "additional_information_required",
            ].includes(a.paymentStatus) && (
              <ReceiptForm
                appointmentId={a.id}
                locale={locale}
                onSubmitted={() => {
                  setItems((previous) =>
                    previous.map((item) =>
                      item.id === a.id
                        ? {
                            ...item,
                            paymentStatus: "under_review",
                            status: "awaiting_verification",
                          }
                        : item,
                    ),
                  );
                  setMessage(
                    fa
                      ? "رسید خصوصی برای بررسی ارسال شد؛ واریز هنوز تأیید نشده است."
                      : "Private receipt submitted for review. The bank transfer is not yet approved.",
                  );
                }}
              />
            )}
            <PatientReceipts
              appointmentId={a.id}
              locale={locale}
              refreshKey={a.paymentStatus}
            />
            <div style={{ display: "flex", gap: 15, marginTop: 18 }}>
              <button
                className="text-link"
                style={{ background: "none" }}
                onClick={() => request(a.id, "reschedule")}
              >
                {fa ? "درخواست تغییر زمان" : "Request rescheduling"}
              </button>
              <button
                className="text-link"
                style={{ background: "none" }}
                onClick={() => request(a.id, "cancel")}
              >
                {fa ? "درخواست لغو" : "Request cancellation"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
function statusLabel(value: string, locale: Locale) {
  const labels: Record<string, [string, string]> = {
    draft: ["پیش‌نویس", "Draft"],
    awaiting_payment: ["در انتظار پرداخت", "Awaiting payment"],
    awaiting_verification: ["در انتظار بررسی", "Awaiting verification"],
    awaiting_scheduling: ["در انتظار تعیین زمان", "Awaiting scheduling"],
    confirmed: ["تأییدشده", "Confirmed"],
    in_progress: ["در حال انجام", "In progress"],
    completed: ["انجام‌شده", "Completed"],
    cancelled: ["لغوشده", "Cancelled"],
    rejected: ["ردشده", "Rejected"],
    expired: ["منقضی‌شده", "Expired"],
    receipt_submitted: ["رسید ارسال‌شده", "Receipt submitted"],
    under_review: ["در حال بررسی", "Under review"],
    approved: ["پرداخت تأییدشده", "Payment approved"],
    additional_information_required: [
      "نیاز به اطلاعات بیشتر",
      "Additional information required",
    ],
    refunded: ["مستردشده", "Refunded"],
  };
  return labels[value]?.[locale === "fa" ? 0 : 1] || value;
}
function ReceiptForm({
  appointmentId,
  locale,
  onSubmitted,
}: {
  appointmentId: string;
  locale: Locale;
  onSubmitted: () => void;
}) {
  const fa = locale === "fa";
  const [banks, setBanks] = useState<
    { id: string; bankName: string; holderName: string; cardNumber: string }[]
  >([]);
  const [bank, setBank] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [uploadKey, setUploadKey] = useState(() => crypto.randomUUID());
  const [pendingUpload, setPendingUpload] = useState<{
    receiptId: string;
    pathname: string;
  } | null>(null);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setBanks(d.banks || []));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (
      file.size === 0 ||
      file.size > MAX_RECEIPT_BYTES ||
      !RECEIPT_MIME_TYPES.includes(
        file.type as (typeof RECEIPT_MIME_TYPES)[number],
      )
    ) {
      setMessage(
        fa
          ? "فایل باید JPEG، PNG، WebP یا PDF و حداکثر ۵ مگابایت باشد."
          : "Use JPEG, PNG, WebP or PDF up to 5 MB.",
      );
      return;
    }
    setBusy(true);
    try {
      let intent = pendingUpload;
      if (!intent) {
        const prepared = await fetch(
          `/api/appointments/${appointmentId}/receipt`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept-Language": locale,
            },
            body: JSON.stringify({
              bankAccountId: bank,
              originalFilename: file.name,
              mimeType: file.type,
              fileSize: file.size,
              idempotencyKey: uploadKey,
            }),
          },
        );
        const data = await prepared.json();
        if (!prepared.ok) throw new Error(data.message);
        intent = { receiptId: data.receiptId, pathname: data.pathname };
        setPendingUpload(intent);
      }
      if (!uploaded) {
        await upload(intent.pathname, file, {
          access: "private",
          handleUploadUrl: "/api/receipts/uploads",
          clientPayload: JSON.stringify({ receiptId: intent.receiptId }),
          contentType: file.type,
          multipart: false,
          headers: { "Accept-Language": locale },
          onUploadProgress: (event) => setUploadProgress(event.percentage),
        });
        setUploaded(true);
      }
      setUploadProgress(100);
      const finalized = await fetch(
        `/api/receipts/${intent.receiptId}/complete`,
        { method: "POST", headers: { "Accept-Language": locale } },
      );
      const result = await finalized.json();
      if (!finalized.ok) {
        if (finalized.status === 422) {
          setPendingUpload(null);
          setUploaded(false);
          setUploadProgress(0);
          setUploadKey(crypto.randomUUID());
        }
        throw new Error(result.message);
      }
      setMessage(
        fa
          ? "رسید خصوصی ذخیره و برای بررسی ارسال شد؛ واریز هنوز تأیید نشده است."
          : "Your private receipt was submitted for review. The bank transfer is not yet approved.",
      );
      setPendingUpload(null);
      setUploaded(false);
      setUploadProgress(0);
      setUploadKey(crypto.randomUUID());
      onSubmitted();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : fa
            ? "خطا در ارسال فایل"
            : "Upload failed",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} style={{ marginTop: 23 }}>
      {banks.map((b) => (
        <div key={b.id} className="bank-card">
          <span>{b.bankName}</span>
          <strong dir="ltr">{b.cardNumber.replace(/(.{4})/g, "$1 ")}</strong>
          <span>{b.holderName}</span>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(b.cardNumber);
              setMessage(fa ? "شماره کارت کپی شد." : "Card number copied.");
            }}
          >
            <Icon name="copy" size={16} />
            {fa ? "کپی شماره کارت" : "Copy card number"}
          </button>
        </div>
      ))}
      <div className="field">
        <label htmlFor={`bank-${appointmentId}`}>
          {fa ? "حساب مقصد" : "Destination account"}
        </label>
        <select
          id={`bank-${appointmentId}`}
          required
          value={bank}
          disabled={busy || !!pendingUpload}
          onChange={(e) => setBank(e.target.value)}
        >
          <option value="">{fa ? "انتخاب کنید" : "Select account"}</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.bankName} — {b.holderName}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`file-${appointmentId}`}>
          {fa
            ? "رسید پرداخت؛ تصویر یا PDF تا ۵ مگابایت"
            : "Receipt: image or PDF, up to 5 MB"}
        </label>
        <input
          id={`file-${appointmentId}`}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          required
          disabled={busy || !!pendingUpload}
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setUploadProgress(0);
          }}
        />
      </div>
      <button className="button button-small" disabled={busy || !banks.length}>
        {fa ? "ارسال رسید برای بررسی" : "Submit receipt for review"}
        <Icon name="upload" size={15} />
      </button>
      {busy && (
        <p role="status" style={{ fontSize: 11, marginTop: 12 }}>
          {uploadProgress >= 100
            ? fa
              ? "در حال بررسی فایل در سرور…"
              : "Validating the uploaded file…"
            : `${Math.round(uploadProgress)}%`}
        </p>
      )}
      {message && (
        <div className="notice" role="status" style={{ marginTop: 15 }}>
          {message}
        </div>
      )}
    </form>
  );
}
