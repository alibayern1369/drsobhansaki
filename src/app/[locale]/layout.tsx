import { siteOrigin, seoDefaults } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/content";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SiteChrome } from "@/components/site-chrome";
import { publicSetting, publicHomeContent } from "@/server/content";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
function assetUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const branding = await publicSetting("branding");
  const seo = await publicSetting("seo");
  const seoTitles = seo?.title as Record<string, string> | undefined;
  const descriptions = seo?.description as Record<string, string> | undefined;
  return {
    metadataBase: new URL(siteOrigin(seo?.siteUrl)),
    verification: {
      google:
        typeof seo?.googleSiteVerification === "string"
          ? seo.googleSiteVerification
          : undefined,
    },
    twitter: { card: "summary_large_image" },
    description:
      descriptions?.[locale] ||
      seoDefaults[locale === "en" ? "en" : "fa"].description,
    title: {
      absolute:
        seoTitles?.[locale] || seoDefaults[locale === "en" ? "en" : "fa"].title,
    },
    alternates: {
      canonical: `/${locale}`,
      languages: { fa: "/fa", en: "/en", "x-default": "/fa" },
    },
    icons: {
      icon: [
        {
          url: assetUrl(branding?.lightFaviconUrl) || "/icon.svg",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: assetUrl(branding?.darkFaviconUrl) || "/icon-dark.svg",
          media: "(prefers-color-scheme: dark)",
        },
      ],
      apple: assetUrl(branding?.appleTouchIconUrl),
    },
    openGraph: {
      type: "website",
      locale: locale === "fa" ? "fa_IR" : "en_US",
      siteName: "Dr. Sobhan Saki",
      images: assetUrl(branding?.socialImageUrl)
        ? [assetUrl(branding?.socialImageUrl)!]
        : [
            {
              url: "/images/doctor.jpg",
              alt: locale === "fa" ? "دکتر سبحان ساکی" : "Dr. Sobhan Saki",
            },
          ],
    },
  };
}
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = await publicHomeContent(locale);
  const contact = await publicSetting("contact");
  const branding = await publicSetting("branding");
  const logo = assetUrl(branding?.logoUrl);
  const color =
    typeof branding?.primaryColor === "string" &&
    /^#[\da-f]{6}$/i.test(branding.primaryColor)
      ? branding.primaryColor
      : "#0866ff";
  const style = {
    "--blue": color,
    ...(logo ? { "--brand-logo": `url("${encodeURI(logo)}")` } : {}),
  } as CSSProperties;
  return (
    <div
      dir={locale === "fa" ? "rtl" : "ltr"}
      lang={locale}
      className={`site-shell ${logo ? "has-custom-logo" : ""}`}
      style={style}
    >
      <a href="#main" className="skip-link">
        {locale === "fa" ? "رفتن به محتوا" : "Skip to content"}
      </a>
      <SiteChrome
        header={<Header locale={locale} content={content} />}
        footer={
          <Footer
            locale={locale}
            content={content}
            social={await publicSetting("social")}
            phone={
              typeof contact?.phone === "string" ? contact.phone : undefined
            }
          />
        }
      >
        {children}
      </SiteChrome>
    </div>
  );
}
