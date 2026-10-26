"use client";
import { usePathname } from "next/navigation";
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
  const admin = /^\/(fa|en)\/admin(?:\/|$)/.test(usePathname());
  return (
    <div className={admin ? "admin-shell" : undefined}>
      {!admin && header}
      {children}
      {!admin && footer}
    </div>
  );
}
