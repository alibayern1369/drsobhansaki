import { z } from "zod";
import { normalizeDigits } from "./admin-labels";
export const consultationKeys = ["phone", "text"] as const;
export function patientAppointmentView<T extends { platformSnapshot: unknown }>(
  appointment: T,
) {
  const platform = appointment.platformSnapshot as { key?: string } | null;
  return {
    ...appointment,
    platformSnapshot: platform ? { key: platform.key } : null,
  };
}
export const bookingDraftSchema = z.object({
  type: z.enum(consultationKeys),
  platform: z.string().max(40).default(""),
  mode: z.enum(["", "doctor", "patient"]).default(""),
  slotId: z.string().max(50).default(""),
  idempotencyKey: z.uuid(),
  savedAt: z.number(),
});
export const bookingDraftKey = (locale: string) => `booking-draft-v2:${locale}`;
export function patientReturnTo(value: unknown, locale: string) {
  const fallback = `/${locale}/dashboard`;
  if (value === "booking") return `/${locale}/booking?resume=1`;
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return fallback;
  try {
    const url = new URL(value, "https://local.invalid");
    return url.origin === "https://local.invalid" &&
      [`/${locale}/booking`, `/${locale}/dashboard`].includes(url.pathname)
      ? url.pathname + url.search
      : fallback;
  } catch {
    return fallback;
  }
}
export type Messenger = {
  key: string;
  link?: string | null;
  username?: string | null;
  contactNumber?: string | null;
};
export function messengerLink(value: Messenger | null | undefined) {
  if (!value) return null;
  if (value.link) {
    try {
      const u = new URL(value.link);
      if (u.protocol === "https:" && !u.username && !u.password) return u.href;
    } catch {}
  }
  const username = (value.username || "").trim().replace(/^@/, "");
  if (
    ["telegram", "bale"].includes(value.key) &&
    /^[a-zA-Z0-9_]{3,64}$/.test(username)
  )
    return `https://${value.key === "telegram" ? "t.me" : "ble.ir"}/${username}`;
  let phone = normalizeDigits(value.contactNumber || "").replace(/[^\d]/g, "");
  if (phone.startsWith("0098")) phone = phone.slice(2);
  if (/^09\d{9}$/.test(phone)) phone = "98" + phone.slice(1);
  if (value.key === "whatsapp" && /^[1-9]\d{7,14}$/.test(phone))
    return `https://wa.me/${phone}`;
  return null;
}
export type BookingConfig = {
  ready: boolean;
  testMode?: boolean;
  booking?: { patientScheduling?: boolean; doctorScheduling?: boolean };
  types: {
    id: string;
    key: string;
    priceRial: number;
    durationMinutes: number;
    enabled?: boolean;
  }[];
  platforms: ({ id: string } & Messenger)[];
  slots: { id: string; consultationTypeId: string; startsAt: string }[];
};
