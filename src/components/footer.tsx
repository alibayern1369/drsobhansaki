import Link from "next/link";
import { copy, type Locale } from "@/lib/content";
import { Brand } from "./header";
import { Icon } from "./icon";
import { normalizeDigits } from "@/lib/admin-labels";
import { formatPhone } from "@/lib/phone-display";
export function Footer({
  locale,
  content,
  phone,
  social,
}: {
  locale: Locale;
  content?: (typeof copy)[Locale];
  phone?: string;
  social?: Record<string, unknown> | null;
}) {
  const t = content || copy[locale];
  const links = [
    ["whatsapp", "WhatsApp", "message"],
    ["telegram", "Telegram", "send"],
    ["instagram", "Instagram", "heart"],
    ["bale", "Bale", "message"],
  ] as const;
  const publicPhone = typeof social?.phone === "string" ? social.phone : phone;
  return (
    <footer className="footer">
      <div className="footer-main">
        <div>
          <Brand locale={locale} content={t} />
          <p>{t.footerDesc}</p>
          <div className="socials">
            {links.map(([key, label, icon]) => {
              const url = social?.[key];
              return typeof url === "string" && url.startsWith("https://") ? (
                <a
                  key={key}
                  href={url}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name={icon} size={18} />
                </a>
              ) : null;
            })}
          </div>
        </div>
        <div>
          <h3>{t.quick}</h3>
          <Link href={`/${locale}/about`}>{t.about}</Link>
          <Link href={`/${locale}/services`}>{t.services}</Link>
          <Link href={`/${locale}/articles`}>{t.articles}</Link>
          <Link href={`/${locale}/booking`}>{t.book}</Link>
        </div>
        <div>
          <h3>{t.connection}</h3>
          {publicPhone && (
            <a
              href={`tel:${normalizeDigits(publicPhone).replace(/[^+0-9]/g, "")}`}
              dir="ltr"
            >
              <bdi dir="ltr">{formatPhone(publicPhone)}</bdi>
            </a>
          )}
          <Link href={`/${locale}/contact`}>
            {t.contact}
            <Icon name="arrow" size={15} />
          </Link>
          <Link href={`/${locale}/dashboard`}>{t.patient}</Link>
        </div>
        <div className="footer-note">
          <span className="small-icon">
            <Icon name="shield" />
          </span>
          <h3>
            {locale === "fa" ? "سلامت شما، امانت ماست" : "Care built on trust"}
          </h3>
          <p>{t.urgent}</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>{t.rights}</span>
        <div>
          <Link href={`/${locale}/privacy`}>{t.privacy}</Link>
          <Link href={`/${locale}/terms`}>{t.terms}</Link>
          <span className="made-with">
            <Icon name="heart" size={14} />
            {locale === "fa"
              ? "با توجه به حال خوب شما"
              : "With your wellbeing in mind"}
          </span>
          <a
            href="https://klandweb.ir"
            target="_blank"
            rel="noopener noreferrer"
            className="developer-credit"
          >
            {locale === "fa"
              ? "طراحی و توسعه توسط کیش لَند وب"
              : "Design & development by Kish Land Web"}
          </a>
        </div>
      </div>
    </footer>
  );
}
