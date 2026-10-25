import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { copy, services, isLocale } from "@/lib/content";
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
}) {
  const { locale, page } = await params;
  const title = titles[page as keyof typeof titles]?.[locale === "fa" ? 0 : 1];
  return {
    title,
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
}: {
  params: Promise<{ locale: string; page: string }>;
}) {
  const { locale, page } = await params;
  if (!isLocale(locale) || !(page in titles)) notFound();
  const fa = locale === "fa";
  const t = copy[locale];
  const title = titles[page as keyof typeof titles][fa ? 0 : 1];
  return (
    <main id="main">
      {page === "login" ? (
        <LoginForm locale={locale} />
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
                        src="/images/doctor.jpg"
                        alt={t.stock}
                        fill
                        sizes="(max-width:700px) 90vw, 40vw"
                      />
                      <span className="photo-label">
                        {fa ? "تصویر نمایشی" : "Illustrative image"}
                      </span>
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
                  ).map((v, i) => (
                    <div key={v}>
                      <h3>{v}</h3>
                      <p>
                        {i === 2
                          ? fa
                            ? "پزشکی عمومی؛ پایش قند، فشار و چربی خون، ارزیابی اولیه تیروئید، کبد چرب و سلامت شغلی."
                            : "General practice; blood sugar, pressure and lipids, initial thyroid assessment, fatty liver and occupational health."
                          : fa
                            ? "پس از تأیید پزشک تکمیل می‌شود."
                            : "To be completed after verification by the doctor."}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="availability-card">
                  <h3>{t.availability}</h3>
                  <p>{t.availabilityDesc}</p>
                </div>
              </>
            )}
            {page === "articles" && (
              <>
                <PublishedJournal locale={locale} />
                <div className="empty-state">
                  <span className="small-icon">
                    <Icon name="file" size={28} />
                  </span>
                  <h2>{t.journalEmpty}</h2>
                  <p>{t.journalEmptyDesc}</p>
                  <p>
                    {fa
                      ? "محتوای تأییدنشده یا ترجمه‌های بررسی‌نشده در این بخش نمایش داده نمی‌شوند."
                      : "Unapproved content and unreviewed translations are not published here."}
                  </p>
                  <Link href={`/${locale}/services`} className="button">
                    {t.services}
                    <Icon name="arrow" size={16} />
                  </Link>
                </div>
              </>
            )}
            {page === "contact" && (
              <div className="service-detail-grid">
                <div className="content-panel">
                  <h2>{fa ? "در کنار شما هستیم" : "We are here for you"}</h2>
                  <p>{t.infoPending}</p>
                  <div className="profile-details">
                    {(fa
                      ? [
                          "شماره تماس",
                          "نشانی مطب",
                          "پیام‌رسان‌ها",
                          "ساعات پاسخ‌گویی",
                        ]
                      : [
                          "Phone number",
                          "Practice address",
                          "Messaging platforms",
                          "Office hours",
                        ]
                    ).map((v) => (
                      <div key={v}>
                        <h3>{v}</h3>
                        <p>
                          {fa ? "در انتظار تأیید" : "Awaiting verification"}
                        </p>
                      </div>
                    ))}
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
            {page === "privacy" && (
              <div className="content-panel">
                <div className="notice warn" style={{ marginBottom: 20 }}>
                  {fa
                    ? "پیش‌نویس سیاست حریم خصوصی؛ پیش از پردازش اطلاعات واقعی بیمار باید توسط مسئول سامانه بررسی و نهایی شود."
                    : "Draft privacy policy. The operator must review and finalize it before processing real patient information."}
                </div>
                <h2>
                  {fa ? "احترام به اطلاعات شما" : "Respecting your information"}
                </h2>
                <p>
                  {fa
                    ? "تنها اطلاعات ضروری برای احراز هویت، هماهنگی نوبت و بررسی پرداخت دریافت می‌شود. دسترسی به پرونده و رسید پرداخت باید محدود به بیمار و کارکنان مجاز باشد."
                    : "Only information necessary for authentication, scheduling and payment verification is collected. Records and receipts must be restricted to the patient and authorized staff."}
                </p>
                <h2>
                  {fa ? "پیام‌رسان‌های خارجی" : "External messaging services"}
                </h2>
                <p>
                  {fa
                    ? "استفاده از واتساپ، تلگرام یا بله نیازمند رضایت شماست و سیاست‌های همان سرویس نیز اعمال می‌شود. اطلاعات حساس را تنها در صورت ضرورت و با راهنمایی پزشک ارسال کنید."
                    : "WhatsApp, Telegram or Bale require your consent and are subject to their own privacy policies. Share sensitive information only when necessary and with the doctor’s guidance."}
                </p>
                <h2>
                  {fa ? "نگهداری و حذف اطلاعات" : "Retention and deletion"}
                </h2>
                <p>
                  {fa
                    ? "مدت نگهداری، محل ذخیره‌سازی، راه تماس مسئول داده و روند درخواست دسترسی یا حذف باید پیش از شروع فعالیت تعیین و در این صفحه درج شوند."
                    : "Retention periods, storage location, the data contact and access or deletion procedures must be determined and listed here before launch."}
                </p>
              </div>
            )}
            {page === "terms" && (
              <div className="content-panel">
                <div className="notice warn" style={{ marginBottom: 20 }}>
                  {fa
                    ? "پیش‌نویس شرایط استفاده؛ نیازمند تأیید نهایی مسئول سامانه."
                    : "Draft terms, pending approval by the operator."}
                </div>
                <h2>{fa ? "دامنهٔ مشاوره" : "Consultation scope"}</h2>
                <p>{t.urgent}</p>
                <p>
                  {fa
                    ? "پزشک ممکن است برای ارزیابی دقیق‌تر، معاینه حضوری، آزمایش یا ارجاع را توصیه کند. هیچ نتیجه درمانی تضمین نمی‌شود."
                    : "The doctor may recommend an in-person examination, tests or referral. Treatment outcomes are not guaranteed."}
                </p>
                <h2>{fa ? "رزرو و پرداخت" : "Booking and payment"}</h2>
                <p>
                  {fa
                    ? "ارسال رسید به‌تنهایی اثبات پرداخت نیست. نوبت پس از تأیید مستقل واریز و تعیین زمان قطعی می‌شود. تعرفه، مدت مشاوره و قوانین لغو و استرداد باید پیش از پرداخت به شما نمایش داده شوند."
                    : "A receipt alone is not proof of payment. An appointment requires independent transfer verification and confirmed scheduling. Pricing, duration, cancellation and refund rules must be shown before payment."}
                </p>
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
