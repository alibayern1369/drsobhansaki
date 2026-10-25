import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { medicalReferences } from "@/db/schema";
import { publishedArticles } from "@/server/content";
import { isLocale } from "@/lib/content";
import { PageBanner } from "@/components/page-banner";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const article = (await publishedArticles(locale)).find(
    (a) => a.slug === slug,
  );
  return {
    title: article?.title,
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
  const article = (await publishedArticles(locale)).find(
    (a) => a.slug === slug,
  );
  if (!article) notFound();
  const refs = await getDb()
    .select()
    .from(medicalReferences)
    .where(eq(medicalReferences.articleId, article.id));
  return (
    <main id="main">
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
          {article.publishedAt?.toLocaleDateString(
            locale === "fa" ? "fa-IR" : "en-US",
          )}
        </p>
        {article.body.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
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
