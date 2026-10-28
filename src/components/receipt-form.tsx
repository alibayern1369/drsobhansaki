"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Locale } from "@/lib/content";
import { normalizeDigits } from "@/lib/admin-labels";
import { Icon } from "./icon";
import { BankCard } from "./bank-card";
import { upload } from "@vercel/blob/client";
import { MAX_RECEIPT_BYTES, RECEIPT_MIME_TYPES } from "@/lib/receipt-policy";
import { patientFetch } from "@/lib/patient-fetch";
export function ReceiptForm({
  appointmentId,
  locale,
  onSubmitted,
  onBusyChange,
}: {
  appointmentId: string;
  locale: Locale;
  onSubmitted: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const fa = locale === "fa";
  const router = useRouter();
  const resumeLogin = () =>
    router.push(
      `/${locale}/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
    );
  const [banks, setBanks] = useState<
    { id: string; bankName: string; holderName: string; cardNumber: string }[]
  >([]);
  const [bank, setBank] = useState("");
  const [banksLoaded, setBanksLoaded] = useState(false);
  const [banksError, setBanksError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [uploadKey, setUploadKey] = useState(() => crypto.randomUUID());
  const [pendingUpload, setPendingUpload] = useState<{
    receiptId: string;
    pathname: string;
  } | null>(null);
  useEffect(() => {
    patientFetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setBanksError(false);
        setBanks(d.banks || []);
        if (d.banks?.length === 1) setBank(d.banks[0].id);
      })
      .catch(() => {
        setBanksError(true);
        setMessage(
          fa
            ? "دریافت حساب‌های بانکی انجام نشد؛ صفحه را دوباره بارگذاری کنید."
            : "Unable to load bank accounts. Reload to retry.",
        );
      })
      .finally(() => setBanksLoaded(true));
  }, [fa]);
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
        const prepared = await patientFetch(
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
              transactionReference: reference,
            }),
          },
        );
        const data = await prepared.json();
        if (prepared.status === 401) {
          resumeLogin();
          return;
        }
        if (!prepared.ok) throw new Error(data.message);
        intent = { receiptId: data.receiptId, pathname: data.pathname };
        setPendingUpload(intent);
      }
      if (!uploaded) {
        try {
          await upload(intent.pathname, file, {
            access: "private",
            handleUploadUrl: "/api/receipts/uploads",
            clientPayload: JSON.stringify({ receiptId: intent.receiptId }),
            contentType: file.type,
            multipart: false,
            headers: { "Accept-Language": locale },
            abortSignal: AbortSignal.timeout(120000),
            onUploadProgress: (event) => setUploadProgress(event.percentage),
          });
          setUploaded(true);
        } catch {
          // A lost upload response may leave a complete private object in storage.
          // Only server-side inspection below decides whether the receipt exists and is valid.
        }
      }
      setUploadProgress(100);
      const finalized = await fetch(
        `/api/receipts/${intent.receiptId}/complete`,
        { method: "POST", headers: { "Accept-Language": locale } },
      );
      const result = await finalized.json();
      if (finalized.status === 401) {
        resumeLogin();
        return;
      }
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
        error instanceof Error && !(error instanceof TypeError)
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
      {!banksLoaded && (
        <p role="status">
          {fa ? "در حال دریافت حساب‌های بانکی…" : "Loading bank accounts…"}
        </p>
      )}
      {banksLoaded && !banksError && !banks.length && (
        <p className="notice warn">
          {fa
            ? "در حال حاضر حساب بانکی فعالی برای پرداخت ثبت نشده است؛ لطفاً از بخش تماس پیگیری کنید."
            : "No payment account is currently active. Please contact support."}
        </p>
      )}
      <div className="bank-card-grid">
        {banks.map((b) => (
          <BankCard key={b.id} bank={b} locale={locale} />
        ))}
      </div>
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
        <label htmlFor={`reference-${appointmentId}`}>
          {fa ? "شماره پیگیری تراکنش بانکی" : "Bank transaction reference"}
        </label>
        <input
          id={`reference-${appointmentId}`}
          dir="ltr"
          required
          minLength={3}
          maxLength={100}
          value={reference}
          disabled={busy || !!pendingUpload}
          onChange={(e) => setReference(normalizeDigits(e.target.value))}
        />
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
            const next = e.target.files?.[0] || null;
            setFile(next);
            setPreview(next ? URL.createObjectURL(next) : "");
            setUploadProgress(0);
          }}
        />
      </div>
      {file && (
        <div className="receipt-file-preview">
          {file.type.startsWith("image/") && preview ? (
            <Image
              src={preview}
              alt={
                fa ? "پیش‌نمایش رسید انتخاب‌شده" : "Selected receipt preview"
              }
              width={500}
              height={400}
              unoptimized
            />
          ) : (
            <p>{file.name} · PDF</p>
          )}
          <button
            type="button"
            className="text-link"
            disabled={busy || !!pendingUpload}
            onClick={() => {
              setFile(null);
              setPreview("");
              const input = document.getElementById(
                `file-${appointmentId}`,
              ) as HTMLInputElement | null;
              if (input) input.value = "";
            }}
          >
            {fa ? "حذف و انتخاب فایل دیگر" : "Remove / replace file"}
          </button>
        </div>
      )}
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
