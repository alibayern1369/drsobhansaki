import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  localizedContent,
  websiteSettings,
  articleTranslations,
  articles,
} from "@/db/schema";
import { copy, type Locale } from "@/lib/content";
export async function publicHomeContent(locale: Locale) {
  if (!process.env.DATABASE_URL) return copy[locale];
  const [row] = await getDb()
    .select({ value: localizedContent.value })
    .from(localizedContent)
    .where(
      and(
        eq(localizedContent.key, "homepage"),
        eq(localizedContent.locale, locale),
        eq(localizedContent.published, true),
      ),
    )
    .limit(1);
  const entries = Object.entries(
    (row?.value || {}) as Record<string, unknown>,
  ).filter(([key, value]) => key in copy[locale] && typeof value === "string");
  return {
    ...copy[locale],
    ...Object.fromEntries(entries),
  } as (typeof copy)[Locale];
}
export async function publicSetting(key: string) {
  if (!process.env.DATABASE_URL) return null;
  const [row] = await getDb()
    .select({ value: websiteSettings.value })
    .from(websiteSettings)
    .where(eq(websiteSettings.key, key));
  return row?.value as Record<string, unknown> | null;
}
export async function publishedArticles(locale: Locale) {
  if (!process.env.DATABASE_URL) return [];
  return getDb()
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articleTranslations.title,
      description: articleTranslations.description,
      body: articleTranslations.body,
      publishedAt: articles.publishedAt,
      approvedAt: articleTranslations.approvedAt,
    })
    .from(articles)
    .innerJoin(
      articleTranslations,
      and(
        eq(articleTranslations.articleId, articles.id),
        eq(articleTranslations.locale, locale),
      ),
    )
    .where(
      and(
        eq(articles.status, "published"),
        eq(articleTranslations.locale, locale),
        eq(articles.id, articleTranslations.articleId),
      ),
    )
    .then((rows) =>
      rows.filter(
        (r) => r.approvedAt && r.publishedAt && r.publishedAt <= new Date(),
      ),
    );
}
