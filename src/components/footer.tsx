import Link from "next/link";
import { copy, type Locale } from "@/lib/content";
import { Brand } from "./header";
import { Icon } from "./icon";
export function Footer({
  locale,
  content,
  phone,
}: {
  locale: Locale;
  content?: (typeof copy)[Locale];
  phone?: string;
}) {
  const t = content || copy[locale];
  return (
    <footer className="footer">
      <div className="footer-main">
        <div>
          <Brand locale={locale} content={t} />
          <p>{t.footerDesc}</p>
          <div className="socials">
            {(["message", "send", "phone"] as const).map((icon) => (
              <Link
                key={icon}
                href={`/${locale}/contact`}
                aria-label={t.contact}
              >
                <Icon name={icon} size={18} />
              </Link>
            ))}
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
          <p>{phone || t.infoPending}</p>
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
        </div>
      </div>
    </footer>
  );
}
