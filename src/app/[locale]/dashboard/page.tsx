import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/server/security";
import { isLocale } from "@/lib/content";
import { PatientDashboard } from "@/components/patient-dashboard";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "پنل بیمار | Patient dashboard",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    view?: string;
    appointment?: string;
    filter?: string;
  }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const auth = await currentUser();
  const query = await searchParams;
  if (!auth) {
    const next = `/${locale}/dashboard?${new URLSearchParams({ ...(query.view ? { view: query.view } : {}), ...(query.appointment ? { appointment: query.appointment } : {}) })}`;
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  }
  return (
    <main id="main" className="page-content">
      <PatientDashboard
        key={`${query.view || "overview"}:${query.appointment || ""}:${query.filter || ""}`}
        locale={locale}
        initialView={query.view}
        appointmentId={query.appointment}
        initialFilter={query.filter}
      />
    </main>
  );
}
