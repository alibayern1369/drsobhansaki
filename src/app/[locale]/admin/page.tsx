import { notFound } from "next/navigation";
import { isLocale } from "@/lib/content";
import { currentUser, isMfaCurrent } from "@/server/security";
import { AdminLogin } from "@/components/admin-login";
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
      {!auth ||
      !["doctor", "super_admin", "staff"].includes(auth.user.role) ||
      (auth.credential && !auth.passwordVerified) ? (
        <AdminLogin locale={locale} />
      ) : (
        <AdminPanel
          locale={locale}
          passwordLogin={!!auth.credential}
          mfaRequired={!isMfaCurrent(auth.mfaVerifiedAt)}
        />
      )}
    </main>
  );
}
