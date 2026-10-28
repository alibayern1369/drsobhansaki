"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "./icon";
import type { ReactNode } from "react";

export function SiteChrome({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
}) {
  const path = usePathname();
  const admin = /^\/(fa|en)\/admin(?:\/|$)/.test(path);
  const login = /^\/(fa|en)\/login\/?$/.test(path);
  const locale = path.startsWith("/en/") ? "en" : "fa";
  return (
    <div className={admin ? "admin-shell" : undefined}>
      {!admin && !login && header}
      {login && (
        <Link className="login-back" href={`/${locale}`}>
          <Icon name={locale === "fa" ? "right" : "left"} size={18} />
          {locale === "fa" ? "بازگشت به سایت" : "Back to website"}
        </Link>
      )}
      {children}
      {!admin && !login && footer}
    </div>
  );
}
