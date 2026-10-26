import type { MetadataRoute } from "next";
import { services } from "@/lib/content";
import { publishedArticles, publicSetting } from "@/server/content";
import { siteOrigin } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin((await publicSetting("seo"))?.siteUrl);
  const result: MetadataRoute.Sitemap = [
    "",
    "/about",
    "/services",
    "/articles",
    "/contact",
    "/privacy",
    "/terms",
    ...services.map((s) => `/services/${s.slug}`),
  ].flatMap((path) =>
    (["fa", "en"] as const).map((locale) => ({
      url: `${base}/${locale}${path}`,
      alternates: {
        languages: { fa: `${base}/fa${path}`, en: `${base}/en${path}` },
      },
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
  );
  const [fa, en] = await Promise.all([
    publishedArticles("fa"),
    publishedArticles("en"),
  ]);
  for (const [locale, items] of [
    ["fa", fa],
    ["en", en],
  ] as const)
    for (const article of items) {
      const languages: Record<string, string> = {};
      if (fa.some((a) => a.slug === article.slug))
        languages.fa = `${base}/fa/articles/${article.slug}`;
      if (en.some((a) => a.slug === article.slug))
        languages.en = `${base}/en/articles/${article.slug}`;
      result.push({
        url: `${base}/${locale}/articles/${article.slug}`,
        lastModified: article.publishedAt || undefined,
        alternates: { languages },
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  return result;
}
