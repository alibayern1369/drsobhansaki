import { normalizeDigits } from "./admin-labels";

export function formatPhone(value: string) {
  const phone = normalizeDigits(value).replace(/[\s()-]/g, "");
  const local = phone.replace(/^(?:\+98|0098)/, "0");
  if (/^09\d{9}$/.test(local))
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return phone;
}
