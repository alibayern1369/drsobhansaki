"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import type { Locale } from "@/lib/content";
import { formatPhone } from "@/lib/phone-display";
export type PatientUser = {
  id: string;
  name: string | null;
  phone: string;
  role: string;
};
export function AccountMenu({ locale }: { locale: Locale }) {
  const fa = locale === "fa",
    path = usePathname(),
    router = useRouter();
  const [user, setUser] = useState<PatientUser | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void fetch("/api/session", { cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw new Error();
          const data = await r.json();
          if (active) {
            setUser(data.user);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError(fa ? "تلاش مجدد" : "Retry");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    refresh();
    window.addEventListener("medical-session-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("medical-session-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [path, fa]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  if (loading)
    return (
      <span
        className="account-skeleton"
        role="status"
        aria-label={fa ? "دریافت حساب کاربری" : "Loading account"}
      />
    );
  if (error)
    return (
      <button
        className="text-link"
        onClick={() =>
          window.dispatchEvent(new Event("medical-session-changed"))
        }
      >
        {error}
      </button>
    );
  if (!user)
    return (
      <Link
        className="login-link patient-signin-link"
        aria-label={fa ? "ورود / ثبت‌نام" : "Sign in"}
        href={`/${locale}/login`}
      >
        <Icon name="user" size={17} />
        {fa ? "ورود / ثبت‌نام" : "Sign in"}
      </Link>
    );
  const links = fa
    ? [
        "پیشخوان",
        "نوبت‌های من",
        "پرداخت‌ها و رسیدها",
        "پیام‌ها و اعلان‌ها",
        "حساب کاربری",
      ]
    : [
        "Overview",
        "My appointments",
        "Payments & receipts",
        "Notifications",
        "Profile",
      ];
  return (
    <div
      className="account-menu"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          wrap.current?.querySelector("button")?.focus();
        }
      }}
    >
      <button
        className="account-trigger"
        aria-label={
          fa
            ? `حساب کاربری ${user.name || user.phone.slice(-4)}`
            : `Account ${user.name || user.phone.slice(-4)}`
        }
        aria-expanded={open}
        aria-controls="account-dropdown"
        onClick={() => setOpen(!open)}
      >
        <span className="account-avatar" aria-hidden="true">
          {user.name?.trim().slice(0, 1) || <Icon name="user" size={18} />}
        </span>
        <span>
          {user.name?.trim() || (fa ? "حساب بیمار" : "Patient account")}
        </span>
        <span className="account-chevron" aria-hidden="true">
          <Icon name="down" size={16} />
        </span>
      </button>
      {open && (
        <div className="account-dropdown" id="account-dropdown">
          <p>
            {user.name || (fa ? "حساب شما" : "Your account")}
            <small dir="ltr">{formatPhone(user.phone)}</small>
          </p>
          {links.map((label, i) => (
            <Link
              key={label}
              onClick={() => setOpen(false)}
              href={`/${locale}/dashboard?view=${["overview", "appointments", "payments", "notifications", "profile"][i]}`}
            >
              {label}
            </Link>
          ))}
          {user.role !== "patient" && (
            <Link href={`/${locale}/admin`}>
              {fa ? "پنل مدیریت" : "Administration"}
            </Link>
          )}
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch("/api/auth/logout", { method: "POST" });
                if (!r.ok) throw new Error();
                setUser(null);
                setOpen(false);
                window.dispatchEvent(new Event("medical-session-changed"));
                router.push(`/${locale}/login`);
                router.refresh();
              } catch {
                setError(
                  fa
                    ? "خروج انجام نشد؛ دوباره تلاش کنید"
                    : "Logout failed; retry",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {fa ? "خروج از حساب" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
