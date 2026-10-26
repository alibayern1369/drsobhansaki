export const siteOrigin = (configured?: unknown) => {
  const value =
    typeof configured === "string" && configured
      ? configured
      : process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const url = new URL(value || "");
    if (
      url.protocol === "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      return url.origin;
  } catch {}
  return "https://drsobhansaki.vercel.app";
};
export const seoDefaults = {
  fa: {
    title: "دکتر سبحان ساکی | پزشک و دستیار تخصصی طب کار | Sobhan Saki",
    description:
      "وب‌سایت دکتر سبحان ساکی، پزشک و دستیار تخصصی طب کار و بیماری‌های شغلی دانشگاه علوم پزشکی ایران؛ نظام پزشکی ۱۷۱۳۴۱. معرفی، مشاوره آنلاین و مقالات سلامت.",
  },
  en: {
    title: "Dr. Sobhan Saki | Physician & Occupational Medicine Resident",
    description:
      "Meet Dr. Sobhan Saki, physician and occupational medicine resident at Iran University of Medical Sciences. Medical registration 171341. Online consultations and health education.",
  },
};
