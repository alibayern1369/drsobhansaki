"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { copy, type Locale } from "@/lib/content";
import { Icon } from "./icon";
import { AccountMenu } from "./account-menu";
export function Brand({
  locale,
  content,
}: {
  locale: Locale;
  content?: (typeof copy)[Locale];
}) {
  const t = content || copy[locale];
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
export function Header({
  locale,
  content,
}: {
  locale: Locale;
  content?: (typeof copy)[Locale];
}) {
  const t = content || copy[locale];
  const [open, setOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  const links = [
    [`/${locale}`, t.home],
    [`/${locale}/about`, t.about],
    [`/${locale}/services`, t.services],
    [`/${locale}/articles`, t.articles],
    [`/${locale}/contact`, t.contact],
  ];
  return (
    <header
      className="header"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          menuToggle.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Brand locale={locale} content={t} />
      <nav
        id="main-navigation"
        className={open ? "navigation is-open" : "navigation"}
        aria-label={locale === "fa" ? "منوی اصلی" : "Main navigation"}
      >
        {links.map(([href, label]) => (
          <Link
            className={path === href ? "active" : ""}
            aria-current={path === href ? "page" : undefined}
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
          lang={locale === "fa" ? "en" : "fa"}
          hrefLang={locale === "fa" ? "en" : "fa"}
          aria-label={locale === "fa" ? "Switch to English" : "تغییر زبان به فارسی"}
          href={path.replace(/^\/(fa|en)/, locale === "fa" ? "/en" : "/fa")}
        >
          <Icon name="globe" size={17} />
          {locale === "fa" ? "EN" : "فا"}
        </Link>
        <span className="nav-divider" />
        <AccountMenu locale={locale} />
        <Link className="button button-small" href={`/${locale}/booking`}>
          {t.book}
          <Icon name="arrow" size={16} />
        </Link>
        <button
          ref={menuToggle}
          type="button"
          className="menu-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="main-navigation"
          aria-label={locale === "fa" ? "منوی اصلی" : "Main menu"}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>
    </header>
  );
}
