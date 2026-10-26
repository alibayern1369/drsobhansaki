import { siteOrigin } from "@/lib/seo";
import type { MetadataRoute } from "next";
import { publicSetting } from "@/server/content";
export const dynamic = "force-dynamic";
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = siteOrigin((await publicSetting("seo"))?.siteUrl);
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/site-images/"],
      disallow: [
        "/api/",
        "/fa/admin",
        "/en/admin",
        "/fa/dashboard",
        "/en/dashboard",
        "/fa/login",
        "/en/login",
        "/fa/booking",
        "/en/booking",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
