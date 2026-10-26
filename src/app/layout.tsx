import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import "./pages.css";
import "./responsive.css";
import "./admin.css";
const vazir = localFont({
  src: "../../public/fonts/Vazirmatn.ttf",
  variable: "--font-vazir",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "دکتر سبحان ساکی | مراقب سلامتی شما",
    template: "%s | دکتر سبحان ساکی",
  },
  description: "مشاوره با پزشک عمومی و درخواست نوبت آنلاین دکتر سبحان ساکی.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get("x-locale") === "en" ? "en" : "fa";
  return (
    <html
      lang={locale}
      dir={locale === "fa" ? "rtl" : "ltr"}
      className={vazir.variable}
    >
      <body>{children}</body>
    </html>
  );
}
