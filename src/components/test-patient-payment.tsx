"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import type { Locale } from "@/lib/content";
export function TestPatientPayment({
  id,
  status,
  locale,
  onChange,
}: {
  id: string;
  status: string;
  locale: Locale;
  onChange: () => Promise<void>;
}) {
  const fa = locale === "fa";
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/test-patient/appointments/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      await onChange();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="test-payment">
      <p className="notice warn">
        {fa
          ? "پرداخت آزمایشی — وجهی واریز نکنید. این نوبت در آمار، تقویم و سوابق مالی واقعی ثبت نمی‌شود. فایل انتخابی فقط در مرورگر نمایش داده می‌شود و به سرور ارسال نمی‌شود."
          : "Simulated payment: do not transfer funds. This booking is isolated from real schedules and financial records. The selected file stays in your browser."}
      </p>
      {status === "awaiting_payment" && (
        <>
          <div className="field">
            <label htmlFor={`test-receipt-${id}`}>
              {fa
                ? "انتخاب رسید آزمایشی (عکس یا PDF)"
                : "Choose a test receipt (image or PDF)"}
            </label>
            <input
              id={`test-receipt-${id}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                setError("");
                setFile(null);
                setPreview("");
                if (selected) {
                  if (
                    selected.size > 4 * 1024 * 1024 ||
                    ![
                      "image/jpeg",
                      "image/png",
                      "image/webp",
                      "application/pdf",
                    ].includes(selected.type)
                  ) {
                    setError(
                      fa
                        ? "عکس یا PDF تا ۴ مگابایت انتخاب کنید."
                        : "Choose an image or PDF up to 4 MB.",
                    );
                    return;
                  }
                  setFile(selected);
                  if (selected.type.startsWith("image/"))
                    setPreview(URL.createObjectURL(selected));
                }
              }}
            />
          </div>
          {preview && (
            <Image
              unoptimized
              width={600}
              height={800}
              src={preview}
              alt={fa ? "پیش‌نمایش رسید آزمایشی" : "Test receipt preview"}
              className="receipt-preview"
            />
          )}
          <button
            className="button"
            disabled={!file || busy}
            onClick={() => act("receipt")}
          >
            {fa ? "ثبت رسید آزمایشی" : "Submit test receipt"}
          </button>
        </>
      )}
      {status === "under_review" && (
        <>
          <p>
            {fa
              ? "رسید آزمایشی ثبت شد. در حساب واقعی، مدیر باید واریز را در بانک بررسی کند. این دکمه فقط برای حساب تست است."
              : "A real deposit would require independent verification by the administrator. This button is restricted to the test patient."}
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => act("approve")}
          >
            {fa
              ? "شبیه‌سازی تأیید پرداخت و زمان"
              : "Simulate payment approval & scheduling"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
