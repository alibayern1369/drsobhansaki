import { ArticleContent, articleCover } from "@/components/article-content";
import { formatJalali } from "@/lib/jalali";
import { siteOrigin } from "@/lib/seo";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { medicalReferences } from "@/db/schema";
import { publishedArticle, publicSetting } from "@/server/content";
import { isLocale } from "@/lib/content";
import { PageBanner } from "@/components/page-banner";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const article = await publishedArticle(locale, slug);
  return {
    title: article ? `${article.title} | دکتر سبحان ساکی` : undefined,
    openGraph: article
      ? {
          type: "article" as const,
          title: article.title,
          description: article.description || undefined,
          publishedTime: article.publishedAt?.toISOString(),
          images: articleCover(article.body)
            ? [articleCover(article.body)!.src]
            : undefined,
        }
      : undefined,
    description: article?.description,
    alternates: {
      canonical: `/${locale}/articles/${slug}`,
      languages: { fa: `/fa/articles/${slug}`, en: `/en/articles/${slug}` },
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
  const article = await publishedArticle(locale, slug);
  if (!article) notFound();
  const refs = await getDb()
    .select()
    .from(medicalReferences)
    .where(eq(medicalReferences.articleId, article.id));
  const nonce = (await headers()).get("x-nonce") || undefined;
  const origin = siteOrigin((await publicSetting("seo"))?.siteUrl);
  const structured = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt?.toISOString(),
    inLanguage: locale,
    mainEntityOfPage: `${origin}/${locale}/articles/${slug}`,
    author: {
      "@type": "Organization",
      name:
        locale === "fa"
          ? "تیم محتوای وب‌سایت سبحان ساکی"
          : "Sobhan Saki website editorial team",
    },
    image: articleCover(article.body)
      ? `${origin}${articleCover(article.body)!.src}`
      : undefined,
  };
  return (
    <main id="main">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <PageBanner
        locale={locale}
        title={article.title}
        description={article.description || undefined}
      />
      <article
        className="content-panel"
        style={{ maxWidth: 850, margin: "0 auto 40px" }}
      >
        <p style={{ fontSize: 11 }}>
          {locale === "fa" ? "تاریخ انتشار" : "Published"}:{" "}
          {article.publishedAt ? formatJalali(article.publishedAt) : ""}
        </p>
        <p className="article-byline">
          {locale === "fa"
            ? "نویسنده: تیم محتوای وب‌سایت · مطالعه: حدود "
            : "By the website editorial team · Reading time: about "}
          {Math.max(1, Math.ceil(article.body.split(/\s+/).length / 180))}
          {locale === "fa" ? " دقیقه" : " minutes"}
        </p>
        <nav
          className="article-toc"
          aria-label={locale === "fa" ? "فهرست مقاله" : "Contents"}
        >
          {article.body.split(/\n\s*\n/).map((b, i) =>
            b.startsWith("## ") ? (
              <a key={i} href={`#section-${i}`}>
                {b.slice(3)}
              </a>
            ) : null,
          )}
        </nav>
        <ArticleContent body={article.body} />
        <h2>{locale === "fa" ? "منابع" : "References"}</h2>
        {refs.map((r) => (
          <p key={r.id}>
            <a
              className="text-link"
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {r.title}
            </a>
          </p>
        ))}
      </article>
    </main>
  );
}
