import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
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
