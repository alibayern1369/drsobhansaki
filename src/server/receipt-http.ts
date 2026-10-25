import "server-only";
import { z } from "zod";
import { AppError } from "./security";
export function receiptJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function receiptError(error: unknown, request: Request) {
  const english = request.headers.get("accept-language")?.startsWith("en");
  const code =
    error instanceof AppError
      ? error.code
      : error instanceof z.ZodError
        ? "INVALID_INPUT"
        : "REQUEST_FAILED";
  const status =
    error instanceof AppError
      ? error.status
      : error instanceof z.ZodError
        ? 400
        : 503;
  const texts: Record<string, [string, string]> = {
    SIGN_IN_REQUIRED: [
      "برای ارسال یا دریافت رسید وارد حساب خود شوید.",
      "Sign in to upload or download a receipt.",
    ],
    BLOB_NOT_CONFIGURED: [
      "اتصال فضای خصوصی رسید هنوز تنظیم نشده است.",
      "Private receipt storage is not configured.",
    ],
    NOT_FOUND: ["رسید یا درخواست پیدا نشد.", "Receipt or request not found."],
    RECEIPT_DELETED: [
      "فایل رسید طبق سیاست نگهداری حذف شده است؛ سابقهٔ پرداخت محفوظ است.",
      "The receipt file was deleted under the retention policy. Payment history is retained.",
    ],
    INVALID_INPUT: [
      "مشخصات فایل معتبر نیست؛ JPEG، PNG، WebP یا PDF تا ۵ مگابایت مجاز است.",
      "Use a JPEG, PNG, WebP or PDF file up to 5 MB.",
    ],
    UPLOAD_ALREADY_PENDING: [
      "یک بارگذاری در جریان است؛ آن را تکمیل کنید یا پس از انقضا دوباره تلاش کنید.",
      "An upload is already pending. Complete it or retry after it expires.",
    ],
    UPLOAD_NOT_READY: [
      "فایل هنوز آمادهٔ بررسی نیست؛ دوباره تلاش کنید.",
      "The upload is not ready for validation. Please retry.",
    ],
    UPLOAD_EXPIRED: [
      "مجوز بارگذاری منقضی یا نامعتبر است.",
      "Upload permission has expired or is invalid.",
    ],
    INVALID_TRANSITION: [
      "وضعیت پرداخت اجازهٔ این اقدام را نمی‌دهد.",
      "The current payment status does not allow this action.",
    ],
  };
  const message =
    texts[code]?.[english ? 1 : 0] ||
    (english
      ? "Unable to process this request. Please retry."
      : "درخواست انجام نشد؛ دوباره تلاش کنید.");
  return receiptJson({ code, message }, status);
}
export async function smallJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 16384) {
      await reader.cancel();
      throw new AppError(413, "INVALID_INPUT");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new AppError(400, "INVALID_INPUT");
  }
}
