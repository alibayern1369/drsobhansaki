import type { MetadataRoute } from "next";
import { services } from "@/lib/content";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return [
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
}
