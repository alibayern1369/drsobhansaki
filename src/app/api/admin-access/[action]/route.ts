import { z } from "zod";
import { adminAccess } from "@/server/admin-access";
import { AppError, checkOrigin } from "@/server/security";
import { smallJson } from "@/server/receipt-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function handle(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const json = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  try {
    if (request.method !== "GET") await checkOrigin(request);
    const { action } = await params;
    return json(
      await adminAccess(
        action,
        request.method,
        request.method === "GET" ? {} : await smallJson(request),
      ),
    );
  } catch (error) {
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
    const fa = !request.headers.get("accept-language")?.startsWith("en");
    const messages: Record<string, [string, string]> = {
      ACCOUNT_EXISTS: [
        "این شماره قبلاً حساب مدیریت دارد؛ رمز از بخش امنیت همان حساب تغییر می‌کند.",
        "This administrator account already exists. Change its password under its security settings.",
      ],
      INVALID_CREDENTIALS: [
        "نام کاربری یا رمز عبور صحیح نیست.",
        "Invalid username or password.",
      ],
      INVALID_OTP: ["کد نامعتبر یا منقضی است.", "Invalid or expired code."],
      VERIFY_SMS_FIRST: [
        "ابتدا کد پیامکی تأیید را وارد کنید.",
        "Verify the SMS code first.",
      ],
      VERIFY_TOTP_FIRST: [
        "ابتدا کد Google Authenticator را تأیید کنید.",
        "Verify the authenticator code first.",
      ],
      SMS_NOT_CONFIGURED: [
        "تنظیمات ملی‌پیامک را تکمیل کنید.",
        "Configure SMS delivery first.",
      ],
      SMS_DELIVERY_FAILED: [
        "ارسال پیامک انجام نشد؛ تنظیمات و وضعیت سرویس را بررسی کنید.",
        "SMS delivery failed. Check provider settings.",
      ],
      RATE_LIMITED: [
        "تلاش‌های زیاد؛ کمی بعد امتحان کنید.",
        "Too many attempts. Try later.",
      ],
      ADMIN_PASSWORD_REQUIRED: [
        "با نام کاربری و رمز مدیر وارد شوید.",
        "Sign in with your administrator password.",
      ],
    };
    return json(
      {
        code,
        message:
          messages[code]?.[fa ? 0 : 1] ||
          (fa
            ? "درخواست انجام نشد؛ اطلاعات ورود و دسترسی را بررسی کنید."
            : "Request failed. Check your credentials and access."),
      },
      status,
    );
  }
}
export { handle as GET, handle as POST, handle as PUT };
