export function siteAsset(value: unknown, fallback = "") {
  if (typeof value !== "string" || !value) return fallback;
  if (/^\/(?!\/)/.test(value)) return value;
  try {
    return new URL(value).protocol === "https:" ? value : fallback;
  } catch {
    return fallback;
  }
}
export const imageFields = [
  ["doctorImageUrl", "عکس پزشک", "Doctor photo"],
  ["consultationImageUrl", "عکس مشاوره", "Consultation photo"],
  ["medicalImageUrl", "عکس خدمات پزشکی", "Medical care photo"],
  ["logoUrl", "لوگو", "Logo"],
  ["lightFaviconUrl", "آیکون مرورگر روشن", "Light favicon"],
  ["darkFaviconUrl", "آیکون مرورگر تیره", "Dark favicon"],
  ["socialImageUrl", "عکس اشتراک‌گذاری", "Social sharing image"],
] as const;
