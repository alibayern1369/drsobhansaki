import { notFound } from "next/navigation";
import { isLocale, copy } from "@/lib/content";
import { PageBanner } from "@/components/page-banner";
import { BookingForm } from "@/components/booking-form";
export const metadata = {
  title: "درخواست مشاوره | Consultation request",
  robots: { index: false, follow: true },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string; resume?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { type, resume } = await searchParams;
  return (
    <main id="main">
      <PageBanner
        locale={locale}
        title={copy[locale].online}
        description={copy[locale].processDesc}
      />
      <div className="page-content">
        <BookingForm
          locale={locale}
          initialType={type}
          resume={resume === "1"}
        />
      </div>
    </main>
  );
}
