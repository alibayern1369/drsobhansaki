"use client";
import { useState } from "react";
import type { Locale } from "@/lib/content";
import { adminLabel } from "@/lib/admin-labels";
import { MessengerLogo } from "./consultation-contact";
type Platform = {
  id: string;
  key: string;
  enabled: boolean;
  link: string | null;
  contactNumber: string | null;
  username: string | null;
};
export function ContactCards({
  platforms,
  locale,
  busy,
  save,
}: {
  platforms: Platform[];
  locale: Locale;
  busy: boolean;
  save: (path: string, value: unknown) => Promise<boolean>;
}) {
  const fa = locale === "fa";
  const [drafts, setDrafts] = useState(platforms);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  function update(id: string, values: Partial<Platform>) {
    setDrafts((rows) =>
      rows.map((p) => (p.id === id ? { ...p, ...values } : p)),
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage("");
        try {
          for (const p of drafts) {
            if (
              !(await save(`platforms/${p.id}`, {
                enabled: p.enabled,
                contactNumber: p.contactNumber || null,
                username: p.username || null,
                link: p.link || null,
              }))
            ) {
              setMessage(
                fa
                  ? "ذخیره کامل نشد؛ ورودی‌ها حفظ شده‌اند. خطای بالا را اصلاح و دوباره ذخیره کنید."
                  : "Save incomplete. Your inputs are preserved; correct the error and retry.",
              );
              return;
            }
          }
          setMessage(
            fa ? "همه راه‌های ارتباطی ذخیره شدند." : "All contacts saved.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="contact-card-grid">
        {drafts.map((p) => (
          <section
            className={`contact-editor-card messenger-${p.key}`}
            key={p.id}
          >
            <div className="contact-card-heading">
              <MessengerLogo channel={p.key} />
              <h2>{adminLabel(p.key, fa)}</h2>
              <label className="checkbox">
                <input
                  aria-label={`${fa ? "فعال‌سازی" : "Enable"} ${adminLabel(p.key, fa)}`}
                  type="checkbox"
                  checked={p.enabled}
                  disabled={saving || busy}
                  onChange={(e) => update(p.id, { enabled: e.target.checked })}
                />
                {fa ? "فعال" : "Active"}
              </label>
            </div>
            {(
              [
                ["contactNumber", fa ? "شماره تماس" : "Phone"],
                ["username", fa ? "نام کاربری" : "Username"],
                ["link", fa ? "لینک HTTPS" : "HTTPS link"],
              ] as const
            ).map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={`${p.id}-${key}`}>{label}</label>
                <input
                  id={`${p.id}-${key}`}
                  value={p[key] || ""}
                  type={key === "link" ? "url" : "text"}
                  dir="ltr"
                  maxLength={
                    key === "contactNumber"
                      ? 30
                      : key === "username"
                        ? 100
                        : 2048
                  }
                  disabled={saving}
                  onChange={(e) => update(p.id, { [key]: e.target.value })}
                />
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="batch-save-bar">
        <button className="button" disabled={saving || busy}>
          {saving
            ? fa
              ? "در حال ذخیره…"
              : "Saving…"
            : fa
              ? "ذخیره همه راه‌های ارتباطی"
              : "Save all contacts"}
        </button>
        <span role="status">{message}</span>
      </div>
    </form>
  );
}
