import { notFound } from "next/navigation";
import { isLocale } from "@/lib/content";
import { currentUser, isMfaCurrent } from "@/server/security";
import { LoginForm } from "@/components/login-form";
import { AdminPanel } from "@/components/admin-panel";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "مدیریت | Administration",
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
      {!auth ? (
        <LoginForm locale={locale} />
      ) : !["doctor", "super_admin", "staff"].includes(auth.user.role) ? (
        <div className="empty-state">
          <h1>{locale === "fa" ? "دسترسی مجاز نیست" : "Access denied"}</h1>
        </div>
      ) : (
        <AdminPanel
          locale={locale}
          mfaRequired={!isMfaCurrent(auth.mfaVerifiedAt)}
        />
      )}
    </main>
  );
}
