import { normalizeDigits } from "./admin-labels";
const calendar = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});
export const persianMonths = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
export const persianNumber = (value: number | string) =>
  String(value).replace(/\d/g, (c) => "۰۱۲۳۴۵۶۷۸۹"[Number(c)]);
export function jalaliParts(date: Date) {
  const parts = calendar.formatToParts(date);
  const get = (key: string) => Number(parts.find((p) => p.type === key)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}
export function gregorianFromJalali(year: number, month: number, day: number) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  const guess = Date.UTC(year + 621, 2, 20);
  let left = guess - 5 * 86400000,
    right = guess + 373 * 86400000;
  const target = year * 10000 + month * 100 + day;
  while (left <= right) {
    const middle = left + Math.floor((right - left) / 86400000 / 2) * 86400000;
    const value = jalaliParts(new Date(middle));
    const code = value.year * 10000 + value.month * 100 + value.day;
    if (code === target) return new Date(middle).toISOString().slice(0, 10);
    if (code < target) left = middle + 86400000;
    else right = middle - 86400000;
  }
  return null;
}
export function daysInJalaliMonth(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return gregorianFromJalali(year, month, 30) ? 30 : 29;
}
export function tehranDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function formatJalali(value: string | Date, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(includeTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(date);
}
export function parsePersianTime(value: string) {
  const text = normalizeDigits(value).replace(/\s/g, "");
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : null;
}
