"use client";
import { useState } from "react";
import { normalizeDigits } from "@/lib/admin-labels";
import type { Locale } from "@/lib/content";
export type ConsultationFee = {
  id: string;
  key: string;
  priceRial: number;
  durationMinutes: number;
  bufferMinutes: number;
  enabled: boolean;
};
export function ConsultationFees({
  item,
  locale,
  onSaved,
}: {
  item: ConsultationFee;
  locale: Locale;
  onSaved: () => Promise<void>;
}) {
  const fa = locale === "fa";
  const [unit, setUnit] = useState("toman");
  const [price, setPrice] = useState(String(item.priceRial / 10));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const number = (value: FormDataEntryValue | null) => {
    const text = normalizeDigits(String(value ?? "")).replace(/[,٬\s]/g, "");
    if (!/^\d+$/.test(text))
      throw new Error(
        fa ? "فقط عدد صحیح و بدون اعشار وارد کنید." : "Enter a whole number.",
      );
    return Number(text);
  };
  return (
    <form
      className="content-panel fee-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const f = new FormData(e.currentTarget);
          const amount = number(f.get("price")) * (unit === "toman" ? 10 : 1);
          if (!Number.isSafeInteger(amount) || amount > 2000000000)
            throw new Error(
              fa
                ? "مبلغ از محدودهٔ مجاز بیشتر است."
                : "Amount exceeds the supported limit.",
            );
          const r = await fetch(`/api/admin/consultations/${item.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Accept-Language": locale,
            },
            body: JSON.stringify({
              priceRial: amount,
              durationMinutes: number(f.get("duration")),
              bufferMinutes: number(f.get("buffer")),
              enabled: f.get("enabled") === "on",
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.message);
          await onSaved();
          setMessage(
            fa ? "تعرفه با موفقیت ذخیره شد." : "Price saved successfully.",
          );
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>
        {fa
          ? item.key === "phone"
            ? "مشاوره تلفنی"
            : "مشاوره متنی"
          : item.key === "phone"
            ? "Phone consultation"
            : "Text consultation"}
      </h2>
      <div className="two-cols">
        <div className="field">
          <label htmlFor={`price-${item.id}`}>
            {fa ? "مبلغ تعرفه" : "Price"}
          </label>
          <input
            id={`price-${item.id}`}
            name="price"
            type="text"
            inputMode="numeric"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={fa ? "مثلاً ۳۰۰٬۰۰۰" : "300,000"}
          />
        </div>
        <div className="field">
          <label htmlFor={`unit-${item.id}`}>
            {fa ? "واحد مبلغ" : "Currency unit"}
          </label>
          <select
            id={`unit-${item.id}`}
            value={unit}
            onChange={(e) => {
              const n = Number(normalizeDigits(price).replace(/[,٬\s]/g, ""));
              if (Number.isFinite(n))
                setPrice(String(e.target.value === "toman" ? n / 10 : n * 10));
              setUnit(e.target.value);
            }}
          >
            <option value="toman">{fa ? "تومان" : "Toman"}</option>
            <option value="rial">{fa ? "ریال" : "Rial"}</option>
          </select>
        </div>
      </div>
      <p className="field-help">
        {fa
          ? "هر تومان برابر ۱۰ ریال است. ارقام فارسی و جداکنندهٔ هزارگان پذیرفته می‌شوند. تعرفهٔ جدید فقط برای درخواست‌های جدید اعمال می‌شود."
          : "1 toman = 10 rials. New prices apply to new bookings only."}
      </p>
      <div className="two-cols">
        {[
          [
            "duration",
            fa ? "مدت مشاوره (دقیقه)" : "Duration (minutes)",
            item.durationMinutes,
          ],
          [
            "buffer",
            fa ? "فاصلهٔ بین نوبت‌ها (دقیقه)" : "Buffer (minutes)",
            item.bufferMinutes,
          ],
        ].map(([name, label, value]) => (
          <div className="field" key={name}>
            <label htmlFor={`${name}-${item.id}`}>{label}</label>
            <input
              id={`${name}-${item.id}`}
              name={String(name)}
              type="text"
              inputMode="numeric"
              required
              defaultValue={value}
            />
          </div>
        ))}
      </div>
      <label className="checkbox">
        <input type="checkbox" name="enabled" defaultChecked={item.enabled} />
        {fa ? "فعال برای رزرو" : "Available for booking"}
      </label>
      <button className="button" disabled={busy}>
        {fa ? "ذخیره تعرفه" : "Save price"}
      </button>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </form>
  );
}
