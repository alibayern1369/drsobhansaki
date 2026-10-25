import { notFound } from "next/navigation";
import { currentUser } from "@/server/security";
import { isLocale } from "@/lib/content";
import { LoginForm } from "@/components/login-form";
import { PatientDashboard } from "@/components/patient-dashboard";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "پنل بیمار | Patient dashboard",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const auth = await currentUser();
  return (
    <main id="main" className="page-content">
      {auth ? (
        <PatientDashboard locale={locale} />
      ) : (
        <LoginForm locale={locale} />
      )}
    </main>
  );
}
