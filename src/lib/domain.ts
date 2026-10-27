import { z } from "zod";
export const phoneSchema = z.string().regex(/^09\d{9}$/);
export const bookingSchema = z
  .object({
    consultationTypeId: z.uuid(),
    platformId: z.uuid().optional(),
    slotId: z.uuid().optional(),
    schedulingMode: z.enum(["patient", "doctor"]),
    consent: z.literal(true),
    idempotencyKey: z.uuid(),
    expectedPriceRial: z.number().int().min(0).max(2000000000).optional(),
  })
  .refine((x) => x.schedulingMode !== "patient" || !!x.slotId, {
    message: "Slot required",
  });
export const appointmentTransitions: Record<string, readonly string[]> = {
  draft: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["awaiting_verification", "cancelled", "expired"],
  awaiting_verification: [
    "awaiting_scheduling",
    "confirmed",
    "rejected",
    "cancelled",
    "expired",
  ],
  awaiting_scheduling: ["confirmed", "cancelled", "expired"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  rejected: [],
  expired: [],
};
export const paymentTransitions: Record<string, readonly string[]> = {
  awaiting_payment: ["receipt_submitted", "expired"],
  receipt_submitted: ["under_review"],
  under_review: ["approved", "rejected", "additional_information_required"],
  additional_information_required: ["receipt_submitted", "expired"],
  approved: ["refunded"],
  rejected: ["receipt_submitted", "expired"],
  expired: [],
  refunded: [],
};
export function assertTransition(
  kind: "appointment" | "payment",
  from: string,
  to: string,
) {
  if (from === to) return;
  if (
    !(kind === "appointment" ? appointmentTransitions : paymentTransitions)[
      from
    ]?.includes(to)
  )
    throw new Error("INVALID_TRANSITION");
}
export function formatMoney(
  rial: number,
  locale: "fa" | "en",
  unit: "rial" | "toman" = "toman",
) {
  if (!Number.isSafeInteger(rial) || rial < 0) throw new Error("INVALID_MONEY");
  return `${new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: 1 }).format(unit === "toman" ? rial / 10 : rial)} ${locale === "fa" ? (unit === "toman" ? "تومان" : "ریال") : unit === "toman" ? "Toman" : "IRR"}`;
}
export function validateReceipt(bytes: Uint8Array, declaredMime: string) {
  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024)
    throw new Error("INVALID_FILE_SIZE");
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const pdf = String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  const webp =
    bytes.length >= 16 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" &&
    ["VP8 ", "VP8L", "VP8X"].includes(
      String.fromCharCode(...bytes.slice(12, 16)),
    );
  const mime = png
    ? "image/png"
    : jpeg
      ? "image/jpeg"
      : pdf
        ? "application/pdf"
        : webp
          ? "image/webp"
          : null;
  if (!mime || mime !== declaredMime) throw new Error("INVALID_FILE_SIGNATURE");
  return mime;
}
export const canVerifyPayment = (role: string) =>
  ["doctor", "super_admin"].includes(role);
