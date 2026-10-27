"use client";
import { useEffect, useState } from "react";
import { adminLabel } from "@/lib/admin-labels";
import type { Locale } from "@/lib/content";
export function ConsultationContact({
  id,
  locale,
}: {
  id: string;
  locale: Locale;
}) {
  const fa = locale === "fa";
  const [channels, setChannels] = useState<
    { key: string; url: string }[] | null
  >(null);
  const [error, setError] = useState("");
  const [instructions, setInstructions] = useState("");
  const [type, setType] = useState("text");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(`/api/appointments/${id}/contact`, {
      headers: { "Accept-Language": locale },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        if (active) {
          setChannels(d.channels);
          setInstructions(d.instructions?.[locale] || "");
          setType(d.type || "text");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, locale, retry]);
  return (
    <section className="consultation-contact">
      <h3>{fa ? "راه ارتباط با پزشک" : "Contact your doctor"}</h3>
      {instructions && <p>{instructions}</p>}
      <p>
        {type === "phone"
          ? fa
            ? "برای مشاوره تلفنی طبق راهنمای پزشک و در زمان نوبت اقدام کنید."
            : "Follow your doctor's call instructions at your appointment time."
          : fa
            ? "پس از ورود به چت می‌توانید آزمایش، عکس و مدارک مربوط به مشاوره را برای پزشک ارسال کنید. پیام از طرف سایت خودکار ارسال نمی‌شود."
            : "Open your doctor's chat to send relevant test results, images and documents. The website does not send a message automatically."}
      </p>
      {channels === null ? (
        error ? (
          <button
            className="button"
            onClick={() => {
              setError("");
              setRetry((v) => v + 1);
            }}
          >
            {fa ? "دریافت دوباره راه ارتباطی" : "Retry loading chat"}
          </button>
        ) : (
          <p role="status">
            {fa ? "دریافت راه ارتباطی پزشک…" : "Loading doctor chat…"}
          </p>
        )
      ) : channels.length ? (
        <div className="chat-buttons">
          {channels.map((c) => (
            <a
              key={c.key}
              href={c.url}
              className="button"
              target="_blank"
              rel="noopener noreferrer"
            >
              {c.key === "phone"
                ? fa
                  ? "تماس با پزشک"
                  : "Call doctor"
                : fa
                  ? `ورود به چت ${adminLabel(c.key, true)}`
                  : `Open ${adminLabel(c.key, false)} chat`}
            </a>
          ))}
        </div>
      ) : instructions ? null : (
        <p className="notice warn">
          {fa
            ? "راه ارتباطی پزشک هنوز ثبت نشده است. لطفاً از صفحه تماس برای هماهنگی استفاده کنید."
            : "Doctor chat details have not been configured. Please use the contact page to coordinate."}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
