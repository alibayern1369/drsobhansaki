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
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: locale === "fa" ? "دکتر سبحان ساکی" : "Dr. Sobhan Saki",
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
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
