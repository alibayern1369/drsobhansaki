import { legalContent } from "@/lib/legal-content";
import { formatPhone } from "@/lib/phone-display";
import { ArticleContent } from "@/components/article-content";
import {
  publicHomeContent,
  publicSetting,
  publishedArticles,
} from "@/server/content";
import { siteAsset } from "@/lib/site-assets";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { services, isLocale, doctorProfile } from "@/lib/content";
import { Icon, type IconName } from "@/components/icon";
import { PageBanner } from "@/components/page-banner";
import { LoginForm } from "@/components/login-form";
import { PublishedJournal } from "@/components/published-journal";
const titles = {
  about: ["درباره پزشک", "About the doctor"],
  services: ["خدمات پزشکی", "Medical services"],
  articles: ["مجله سلامت", "Health journal"],
  contact: ["تماس با ما", "Contact"],
  privacy: ["حریم خصوصی", "Privacy policy"],
  terms: ["شرایط استفاده", "Terms of use"],
  login: ["ورود به حساب", "Sign in"],
  dashboard: ["پنل بیمار", "Patient dashboard"],
} as const;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; page: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale, page } = await params;
  const title = titles[page as keyof typeof titles]?.[locale === "fa" ? 0 : 1];
  return {
    title: `${title} | ${locale === "fa" ? "دکتر سبحان ساکی" : "Dr. Sobhan Saki"}`,
    description:
      page === "privacy"
        ? locale === "fa"
          ? "حریم خصوصی وب‌سایت دکتر سبحان ساکی؛ نحوه استفاده از شماره همراه، سوابق نوبت و رسید پرداخت، دسترسی مجاز و درخواست اصلاح یا حذف اطلاعات."
          : "Privacy policy for patient authentication, appointment information, payment receipts, retention and access requests."
        : page === "terms"
          ? locale === "fa"
            ? "شرایط مشاوره آنلاین دکتر سبحان ساکی؛ ثبت نوبت، تعرفه، تأیید واریز، تغییر زمان، لغو، استرداد و حدود خدمات غیرحضوری."
            : "Terms for online consultations, booking, payment verification, cancellation, refunds and remote care."
          : undefined,
    alternates: {
      canonical: `/${locale}/${page}`,
      languages: { fa: `/fa/${page}`, en: `/en/${page}` },
    },
    robots: ["login", "dashboard"].includes(page)
      ? { index: false }
      : undefined,
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; page: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale, page } = await params;
  if (!isLocale(locale) || !(page in titles)) notFound();
  const fa = locale === "fa";
  const t = await publicHomeContent(locale);
  const branding = await publicSetting("branding");
  const contact = await publicSetting("contact");
  const policies = await publicSetting("policies");
  const journal = page === "articles" ? await publishedArticles(locale) : [];
  const localText = (value: unknown) =>
    typeof value === "object" && value
      ? String((value as Record<string, unknown>)[locale] || "")
      : "";
  const title = titles[page as keyof typeof titles][fa ? 0 : 1];
  return (
    <main id="main">
      {page === "login" ? (
        <LoginForm locale={locale} returnTo={(await searchParams)?.next} />
      ) : (
        <>
          <PageBanner
            locale={locale}
            title={title}
            description={
              page === "services"
                ? t.medicalDesc
                : page === "articles"
                  ? t.journalDesc
                  : undefined
            }
          />
          <div className="page-content">
            {page === "services" && (
              <div className="services-grid">
                {services.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/${locale}/services/${s.slug}`}
                    className="service-card"
                  >
                    <span className="small-icon">
                      <Icon name={s.icon as IconName} />
                    </span>
                    <h3 style={{ marginTop: 15 }}>{s[locale]}</h3>
                    <p>{fa ? s.desc : s.enDesc}</p>
                    <span className="service-arrow">
                      <Icon name="arrow" size={18} />
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {page === "about" && (
              <>
                <div className="about-section" style={{ paddingTop: 0 }}>
                  <div className="about-visual">
                    <div className="about-photo">
                      <Image
                        src={siteAsset(
                          branding?.doctorImageUrl,
                          "/images/doctor.jpg",
                        )}
                        unoptimized={!!branding?.doctorImageUrl}
                        alt={t.stock}
                        fill
                        sizes="(max-width:700px) 90vw, 40vw"
                      />
                    </div>
                    <div className="about-blue-block">
                      <Icon name="doctor" size={40} />
                    </div>
                  </div>
                  <div className="about-copy">
                    <span className="eyebrow">{t.profession}</span>
                    <h2>{t.name}</h2>
                    <p>{t.doctorDesc}</p>
                    <p className="notice" style={{ margin: "20px 0" }}>
                      {t.doctorNote}
                    </p>
                    <Link href={`/${locale}/booking`} className="button">
                      {t.book}
                      <Icon name="arrow" size={18} />
                    </Link>
                  </div>
                </div>
                <div className="profile-details">
                  {(fa
                    ? [
                        "تحصیلات و سوابق حرفه‌ای",
                        "شماره نظام پزشکی",
                        "زمینه‌های مشاوره",
                        "اطلاعات تماس",
                      ]
                    : [
                        "Education & experience",
                        "Medical registration",
                        "Consultation interests",
                        "Contact information",
                      ]
                  ).map((v, i) =>
                    i === 1 &&
                    (contact?.showOfficeAddress !== true ||
                      !localText(contact?.address)) ? null : (
                      <div key={v}>
                        <h3>{v}</h3>
                        <p>
                          {[
                            localText(contact?.education) ||
                              doctorProfile.education[locale],
                            localText(contact?.registration) ||
                              doctorProfile.registration[locale],
                            localText(contact?.interests),
                            contact?.phone ? (
                              <bdi dir="ltr">
                                {formatPhone(String(contact.phone))}
                              </bdi>
                            ) : (
                              ""
                            ),
                          ][i] ||
                            (i === 2
                              ? fa
                                ? "پزشکی عمومی؛ پایش قند، فشار و چربی خون، ارزیابی اولیه تیروئید، کبد چرب و سلامت شغلی."
                                : "General practice; blood sugar, pressure and lipids, initial thyroid assessment, fatty liver and occupational health."
                              : fa
                                ? "اطلاعات به‌زودی تکمیل می‌شود."
                                : "To be completed after verification by the doctor.")}
                        </p>
                      </div>
                    ),
                  )}
                </div>
                <div className="availability-card">
                  <h3>{t.availability}</h3>
                  <p>{t.availabilityDesc}</p>
                </div>
              </>
            )}
            {page === "articles" && (
              <>
                <PublishedJournal locale={locale} articles={journal} />
                {!journal.length && (
                  <div className="empty-state">
                    <span className="small-icon">
                      <Icon name="file" size={28} />
                    </span>
                    <h2>{t.journalEmpty}</h2>
                    <p>{t.journalEmptyDesc}</p>
                    <p>
                      {fa
                        ? "مقالات آموزشی سلامت و طب کار را در این بخش بخوانید."
                        : "Read educational articles about health and occupational medicine."}
                    </p>
                    <Link href={`/${locale}/services`} className="button">
                      {t.services}
                      <Icon name="arrow" size={16} />
                    </Link>
                  </div>
                )}
              </>
            )}
            {page === "contact" && (
              <div className="service-detail-grid">
                <div className="content-panel">
                  <h2>{fa ? "در کنار شما هستیم" : "We are here for you"}</h2>
                  <p>{t.infoPending}</p>
                  <div className="profile-details">
                    {(fa
                      ? ["شماره تماس", "نشانی مطب", "ایمیل", "ساعات پاسخ‌گویی"]
                      : [
                          "Phone number",
                          "Practice address",
                          "Email",
                          "Office hours",
                        ]
                    ).map((v, i) =>
                      i === 1 &&
                      (contact?.showOfficeAddress !== true ||
                        !localText(contact?.address).trim()) ? null : (
                        <div key={v}>
                          <h3>{v}</h3>
                          <p>
                            {[
                              contact?.phone ? (
                                <bdi dir="ltr">
                                  {formatPhone(String(contact.phone))}
                                </bdi>
                              ) : (
                                ""
                              ),
                              localText(contact?.address),
                              String(contact?.email || ""),
                              localText(contact?.hours),
                            ][i] || (fa ? "در انتظار تکمیل" : "Not provided")}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                  <p className="notice warn">{t.urgent}</p>
                </div>
                <aside className="booking-sidebar">
                  <Icon name="calendar" size={30} />
                  <h3 style={{ marginTop: 15 }}>{t.online}</h3>
                  <p style={{ fontSize: 12, marginBottom: 20 }}>
                    {t.processDesc}
                  </p>
                  <Link
                    href={`/${locale}/booking`}
                    className="button full-width"
                  >
                    {t.book}
                  </Link>
                </aside>
              </div>
            )}
            {(page === "privacy" || page === "terms") && (
              <div className="content-panel legal-content">
                <ArticleContent
                  body={
                    localText(policies?.[page]) || legalContent[page][locale]
                  }
                />
              </div>
            )}
            {page === "dashboard" && (
              <div className="empty-state">
                <span className="small-icon">
                  <Icon name="lock" />
                </span>
                <h2>
                  {fa
                    ? "نوبت‌های شما، در یک نگاه"
                    : "Your appointments, in one place"}
                </h2>
                <p>
                  {fa
                    ? "برای مشاهده اطلاعات شخصی، وضعیت پرداخت و پیگیری نوبت وارد حساب خود شوید."
                    : "Sign in to view your personal information, payment status and appointment updates."}
                </p>
                <Link className="button" href={`/${locale}/login`}>
                  {t.login}
                  <Icon name="arrow" size={17} />
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
