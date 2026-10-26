"use client";
import { useState } from "react";
import type { Locale } from "@/lib/content";
import { normalizeDigits } from "@/lib/admin-labels";
export function AdminAccountCreator({
  locale,
  onCreated,
}: {
  locale: Locale;
  onCreated: () => Promise<void>;
}) {
  const fa = locale === "fa";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="content-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        setBusy(true);
        setMessage("");
        try {
          const r = await fetch("/api/admin-access/account", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept-Language": locale,
            },
            body: JSON.stringify({
              name: f.get("name"),
              phone: normalizeDigits(String(f.get("phone"))),
              username: f.get("username"),
              password: f.get("password"),
              role: f.get("role"),
              currentPassword: f.get("currentPassword"),
            }),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.message);
          setMessage(
            fa
              ? "حساب ساخته شد. کاربر می‌تواند با نام کاربری و رمز تعیین‌شده از صفحهٔ مدیریت وارد شود."
              : "Account created. The user can sign in at the administration page.",
          );
          form.reset();
          await onCreated();
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{fa ? "افزودن حساب مدیریت" : "Create administrator account"}</h2>
      <p>
        {fa
          ? "برای پزشک یا کارکنان، نام کاربری و رمز جدا تعیین کنید. اگر شماره متعلق به بیمار موجود باشد، حساب او به نقش انتخاب‌شده ارتقا می‌یابد."
          : "Create a separate login for a doctor or staff member. An existing patient with this phone will be promoted."}
      </p>
      {[
        ["name", "نام و نام خانوادگی", "Full name"],
        ["phone", "شماره همراه", "Mobile number"],
        ["username", "نام کاربری انگلیسی", "Username"],
        [
          "password",
          "رمز حساب جدید (حداقل ۱۲ کاراکتر)",
          "New account password (12+ characters)",
        ],
        [
          "currentPassword",
          "رمز فعلی مدیر کل",
          "Your current administrator password",
        ],
      ].map(([name, f, e]) => (
        <div className="field" key={name}>
          <label htmlFor={`account-${name}`}>{fa ? f : e}</label>
          <input
            id={`account-${name}`}
            name={name}
            required
            type={
              name.toLowerCase().includes("password")
                ? "password"
                : name === "phone"
                  ? "tel"
                  : "text"
            }
            minLength={name === "password" ? 12 : undefined}
            maxLength={
              name === "name"
                ? 100
                : name === "username"
                  ? 64
                  : name === "phone"
                    ? 11
                    : 128
            }
            pattern={
              name === "phone"
                ? "[0-9۰-۹٠-٩]{11}"
                : name === "username"
                  ? "[a-zA-Z0-9._-]{3,64}"
                  : undefined
            }
            autoComplete={
              name === "password"
                ? "new-password"
                : name === "currentPassword"
                  ? "current-password"
                  : "off"
            }
          />
        </div>
      ))}
      <div className="field">
        <label htmlFor="account-role">{fa ? "نقش" : "Role"}</label>
        <select id="account-role" name="role">
          <option value="staff">{fa ? "کارمند مجاز" : "Staff"}</option>
          <option value="doctor">{fa ? "پزشک" : "Doctor"}</option>
          <option value="super_admin">
            {fa ? "مدیر کل" : "Super administrator"}
          </option>
        </select>
      </div>
      <button className="button" disabled={busy}>
        {fa ? "ساخت حساب" : "Create account"}
      </button>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </form>
  );
}
