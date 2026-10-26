import { notFound } from "next/navigation";
import Link from "next/link";
import { copy, isLocale, services } from "@/lib/content";
import { PageBanner } from "@/components/page-banner";
import { Icon } from "@/components/icon";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const s = services.find((s) => s.slug === slug);
  return {
    title: s?.[locale === "fa" ? "fa" : "en"],
    description: locale === "fa" ? s?.desc : s?.enDesc,
    alternates: {
      canonical: `/${locale}/services/${slug}`,
      languages: { fa: `/fa/services/${slug}`, en: `/en/services/${slug}` },
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const service = services.find((s) => s.slug === slug);
  if (!service) notFound();
  const fa = locale === "fa";
  const t = copy[locale];
  return (
    <main id="main">
      <PageBanner
        locale={locale}
        title={service[locale]}
        description={fa ? service.desc : service.enDesc}
      />
      <div className="page-content service-detail-grid">
        <article className="content-panel">
          <h2>
            {fa ? "مراقبت در حوزهٔ پزشکی عمومی" : "Care in general practice"}
          </h2>
          <p>
            {fa
              ? "در این خدمت، نگرانی‌ها و مدارک قبلی شما بررسی می‌شوند. با توجه به شرایط، ممکن است ارزیابی حضوری، آزمایش، پیگیری یا ارجاع لازم باشد."
              : "This service reviews your concerns and previous records. An in-person assessment, tests, follow-up or referral may be needed depending on your circumstances."}
          </p>
          <h2>
            {fa ? "برای مشاوره چه چیزی آماده کنم؟" : "What should I prepare?"}
          </h2>
          <ul>
            <li>
              {fa
                ? "فهرست داروها و مکمل‌هایی که مصرف می‌کنید"
                : "A list of medicines and supplements you take"}
            </li>
            <li>
              {fa
                ? "نتیجه آزمایش‌ها و مدارک مرتبط قبلی"
                : "Relevant previous test results and medical documents"}
            </li>
            <li>
              {fa
                ? "خلاصهٔ نگرانی‌ها و سؤال‌هایی که دارید"
                : "Your concerns and questions"}
            </li>
          </ul>
          <h2>
            {fa
              ? "اطلاعات علمی این خدمت"
              : "Medical information for this service"}
          </h2>
          <div className="notice">
            {fa
              ? "برای آشنایی با علائم، پیشگیری و آماده‌شدن برای مشاوره، مقالات مجله سلامت را بخوانید. ارزیابی و راهنمایی اختصاصی به شرایط هر فرد بستگی دارد."
              : "Read the health journal for educational information on prevention and preparing for a consultation."}
          </div>
          <h2>{fa ? "مطالب مرتبط" : "Related articles"}</h2>
          <p>{t.journalEmptyDesc}</p>
          <Link className="text-link" href={`/${locale}/articles`}>
            {t.articles}
            <Icon name="arrow" size={17} />
          </Link>
        </article>
        <aside className="booking-sidebar">
          <span className="small-icon">
            <Icon name="doctor" />
          </span>
          <h3 style={{ marginTop: 15 }}>{t.name}</h3>
          <p style={{ fontSize: 12, marginBottom: 20 }}>{t.profession}</p>
          <Link className="button full-width" href={`/${locale}/booking`}>
            {t.book}
            <Icon name="arrow" size={17} />
          </Link>
          <p style={{ fontSize: 10, marginTop: 20 }}>{t.urgent}</p>
        </aside>
      </div>
    </main>
  );
}
