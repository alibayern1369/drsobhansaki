"use client";
import { useEffect, useState } from "react";
import { type Locale } from "@/lib/content";
type Receipt = {
  id: string;
  originalFilename: string;
  uploadedAt: string;
  verificationStatus: string;
  deletionStatus: string;
  scanStatus: string;
};
export function PatientReceipts({
  appointmentId,
  locale,
  refreshKey,
}: {
  appointmentId: string;
  locale: Locale;
  refreshKey: string;
}) {
  const fa = locale === "fa";
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch(`/api/appointments/${appointmentId}/receipts`, {
      headers: { "Accept-Language": locale },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        if (active) setReceipts(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [appointmentId, locale, refreshKey]);
  if (error)
    return (
      <p className="notice" role="status">
        {error}
      </p>
    );
  if (!receipts.length) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 14 }}>{fa ? "رسیدهای شما" : "Your receipts"}</h3>
      {receipts.map((r) => (
        <div className="summary-line" key={r.id}>
          <div>
            <strong>{r.originalFilename}</strong>
            <p style={{ fontSize: 10 }}>
              {new Date(r.uploadedAt).toLocaleDateString(
                fa ? "fa-IR" : "en-US",
                { timeZone: "Asia/Tehran" },
              )}
            </p>
          </div>
          {r.deletionStatus === "deleted" ? (
            <span>
              {fa
                ? "فایل طبق سیاست نگهداری حذف شده است"
                : "File deleted under retention policy"}
            </span>
          ) : r.verificationStatus === "pending_upload" ? (
            <span>{fa ? "در انتظار تکمیل بارگذاری" : "Upload pending"}</span>
          ) : r.scanStatus === "invalid_file" ? (
            <span>{fa ? "فایل نامعتبر" : "Invalid file"}</span>
          ) : (
            <a
              className="text-link"
              href={`/api/receipts/${r.id}/download`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {fa ? "دریافت رسید خصوصی" : "Download private receipt"}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
