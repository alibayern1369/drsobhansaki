import { notFound } from "next/navigation";
import { isLocale } from "@/lib/content";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { publicSetting } from "@/server/content";
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
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const branding = await publicSetting("branding");
  const seo = await publicSetting("seo");
  const seoTitles = seo?.title as Record<string, string> | undefined;
  return {
    metadataBase: new URL(base),
    title: {
      absolute:
        seoTitles?.[locale] ||
        (locale === "en"
          ? "Dr. Sobhan Saki | Your wellbeing. Our priority."
          : "دکتر سبحان ساکی | حال خوب شما، اولویت ماست"),
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
        : undefined,
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
      <Header locale={locale} />
      {children}
      <Footer locale={locale} />
    </div>
  );
}
