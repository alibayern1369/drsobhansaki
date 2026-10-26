import { siteOrigin } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/content";
import { Home } from "@/components/home";
import {
  publicHomeContent,
  publicSetting,
  publishedArticles,
} from "@/server/content";
import { headers } from "next/headers";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const nonce = (await headers()).get("x-nonce") || undefined;
  const origin = siteOrigin((await publicSetting("seo"))?.siteUrl);
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    about: {
      "@type": "Person",
      "@id": `${origin}/#doctor`,
      name: "سبحان ساکی",
      alternateName: ["Sobhan Saki", "دکتر سبحان ساکی", "Dr. Sobhan Saki"],
      jobTitle: "پزشک و دستیار تخصصی طب کار و بیماری‌های شغلی",
      identifier: "171341",
      affiliation: {
        "@type": "CollegeOrUniversity",
        name: "Iran University of Medical Sciences",
      },
    },
    name: locale === "fa" ? "دکتر سبحان ساکی" : "Dr. Sobhan Saki",
    url: origin,
    inLanguage: locale,
  };
  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(data).replace(/</g, "\\u003c"),
        }}
      />
      <Home
        locale={locale}
        content={await publicHomeContent(locale)}
        branding={await publicSetting("branding")}
        articles={await publishedArticles(locale)}
      />
    </>
  );
}
