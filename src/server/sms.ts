import "server-only";
import { AppError } from "./security";
import { sendMelipayamak } from "@/lib/melipayamak";
import { storedSmsSettings } from "./integration-settings";
export async function sendSms(
  phone: string,
  message: string,
  otpCode?: string,
) {
  const saved = process.env.DATABASE_URL ? await storedSmsSettings() : null;
  if (saved) {
    try {
      return await sendMelipayamak(phone, message, saved, otpCode);
    } catch {
      throw new AppError(502, "SMS_DELIVERY_FAILED");
    }
  }
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.SMS_PROVIDER === "development"
  ) {
    return { id: "development-no-delivery" };
  }
  if (process.env.SMS_PROVIDER === "melipayamak") {
    try {
      return await sendMelipayamak(
        phone,
        message,
        {
          username: process.env.MELIPAYAMAK_USERNAME,
          password: process.env.MELIPAYAMAK_PASSWORD,
          from: process.env.MELIPAYAMAK_FROM,
          otpBodyId: process.env.MELIPAYAMAK_OTP_BODY_ID,
        },
        otpCode,
      );
    } catch (error) {
      const unconfigured =
        error instanceof Error && error.message === "SMS_NOT_CONFIGURED";
      throw new AppError(
        unconfigured ? 503 : 502,
        unconfigured ? "SMS_NOT_CONFIGURED" : "SMS_DELIVERY_FAILED",
      );
    }
  }
  if (!process.env.SMS_API_URL || !process.env.SMS_API_KEY)
    throw new AppError(503, "SMS_NOT_CONFIGURED");
  const endpoint = new URL(process.env.SMS_API_URL);
  if (endpoint.protocol !== "https:")
    throw new AppError(503, "SMS_NOT_CONFIGURED");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SMS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: phone, message }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new AppError(502, "SMS_DELIVERY_FAILED");
  return { id: res.headers.get("x-request-id") || "accepted" };
}
