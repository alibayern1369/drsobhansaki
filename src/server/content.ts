import "server-only";
import { and, eq, inArray, isNotNull, lte, desc } from "drizzle-orm";
import { getDb } from "@/db";
import {
  localizedContent,
  websiteSettings,
  articleTranslations,
  articles,
} from "@/db/schema";
import { copy, type Locale } from "@/lib/content";
import { cache } from "react";
export const publicHomeContent = cache(async (locale: Locale) => {
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
});
const publicSettings = cache(async () => {
  if (!process.env.DATABASE_URL) return [];
  return getDb()
    .select({ key: websiteSettings.key, value: websiteSettings.value })
    .from(websiteSettings)
    .where(
      inArray(websiteSettings.key, ["branding", "contact", "policies", "seo"]),
    );
});
export async function publicSetting(key: string) {
  const row = (await publicSettings()).find((row) => row.key === key);
  return row?.value as Record<string, unknown> | null;
}
export const publishedArticles = cache(async (locale: Locale) => {
  if (!process.env.DATABASE_URL) return [];
  return getDb()
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articleTranslations.title,
      description: articleTranslations.description,
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
        isNotNull(articleTranslations.approvedAt),
        lte(articles.publishedAt, new Date()),
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(100);
});
export const publishedArticle = cache(async (locale: Locale, slug: string) => {
  if (!process.env.DATABASE_URL) return null;
  const [article] = await getDb()
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articleTranslations.title,
      description: articleTranslations.description,
      body: articleTranslations.body,
      publishedAt: articles.publishedAt,
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
        eq(articles.slug, slug),
        eq(articles.status, "published"),
        isNotNull(articleTranslations.approvedAt),
        lte(articles.publishedAt, new Date()),
      ),
    )
    .limit(1);
  return article || null;
});
