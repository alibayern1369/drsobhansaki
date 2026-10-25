"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { copy, type Locale } from "@/lib/content";
import { Icon } from "./icon";
export function Brand({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <Link href={`/${locale}`} className="brand" aria-label={t.name}>
      <span className="brand-symbol">
        <Icon name="doctor" size={29} />
        <i />
      </span>
      <span>
        <strong>{t.name}</strong>
        <small>{t.profession}</small>
      </span>
    </Link>
  );
}
export function Header({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const links = [
    [`/${locale}`, t.home],
    [`/${locale}/about`, t.about],
    [`/${locale}/services`, t.services],
    [`/${locale}/articles`, t.articles],
    [`/${locale}/contact`, t.contact],
  ];
  return (
    <header className="header">
      <Brand locale={locale} />
      <nav
        className={open ? "navigation is-open" : "navigation"}
        aria-label={locale === "fa" ? "منوی اصلی" : "Main navigation"}
      >
        {links.map(([href, label]) => (
          <Link
            className={path === href ? "active" : ""}
            onClick={() => setOpen(false)}
            href={href}
            key={href}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link
          className="language"
          href={path.replace(/^\/(fa|en)/, locale === "fa" ? "/en" : "/fa")}
        >
          <Icon name="globe" size={17} />
          {locale === "fa" ? "EN" : "فا"}
        </Link>
        <span className="nav-divider" />
        <Link className="login-link" href={`/${locale}/login`}>
          <Icon name="user" size={17} />
          {t.login}
        </Link>
        <Link className="button button-small" href={`/${locale}/booking`}>
          {t.book}
          <Icon name="arrow" size={16} />
        </Link>
        <button
          className="menu-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={locale === "fa" ? "منوی اصلی" : "Main menu"}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>
    </header>
  );
}
