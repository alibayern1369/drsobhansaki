"use client";
import { useEffect, useState } from "react";
import { adminLabel } from "@/lib/admin-labels";
import type { Locale } from "@/lib/content";
import { Icon } from "./icon";
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
      <h3>
        <Icon name="shield" size={22} />
        {fa ? "برای ویزیت آماده شوید" : "Prepare for your consultation"}
      </h3>
      {instructions && <p>{instructions}</p>}
      <p>
        {fa
          ? "در هر دو نوع مشاوره، پزشک در زمان تعیین‌شده با شما تماس می‌گیرد. پیش از ویزیت، آزمایش‌ها، تصاویر و مدارک مرتبط را از یکی از راه‌های زیر برای پزشک بفرستید تا هنگام ویزیت بررسی شوند."
          : "For both phone and text consultations, the doctor will contact you at the scheduled time. Before your visit, send relevant test results, images and documents through one of the channels below."}
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
          {channels
            .filter((c) => ["telegram", "whatsapp", "bale"].includes(c.key))
            .map((c) => (
              <a
                key={c.key}
                href={c.url}
                className={`messenger-button messenger-${c.key}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessengerLogo channel={c.key} />
                <span>
                  {fa
                    ? `ورود به چت ${adminLabel(c.key, true)}`
                    : `Open ${adminLabel(c.key, false)} chat`}
                  <small>
                    {fa
                      ? "ارسال مدارک برای ویزیت"
                      : "Send consultation documents"}
                  </small>
                </span>
                <Icon name="arrow" size={18} />
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

export function MessengerLogo({ channel }: { channel: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="currentColor"
      aria-hidden="true"
    >
      {channel === "telegram" ? (
        <path d="m21.5 3-3.3 17c-.2 1-1 1.2-1.8.6l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1L18 5.9c.4-.4-.1-.6-.6-.3L5.6 13 1 11.5c-1-.3-1-1 .2-1.4L20 2.8c.9-.3 1.7.2 1.5.2Z" />
      ) : channel === "whatsapp" ? (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            d="M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.5-4.5A9 9 0 1 1 21 11.5Z"
          />
          <path d="M8 6.5c-1 0-1.5 1.5-1 3 1 4 4 7 8 7.5 1.5.2 3-1 3-2l-3-1.5-1.2 1.2c-2-.8-3.8-2.5-4.5-4.5L10.5 9 9 6.5Z" />
        </>
      ) : (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            d="M20 16a9 9 0 1 0-12 4l-4 1 1-4"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="m7 12 3 3 7-7"
          />
        </>
      )}
    </svg>
  );
}
