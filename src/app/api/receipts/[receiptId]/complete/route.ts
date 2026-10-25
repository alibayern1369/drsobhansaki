import { z } from "zod";
import { requireUser, checkOrigin } from "@/server/security";
import { completeReceipt } from "@/server/storage";
import { receiptJson, receiptError } from "@/server/receipt-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  try {
    await checkOrigin(request);
    const user = await requireUser();
    const { receiptId } = await params;
    const result = await completeReceipt(z.uuid().parse(receiptId), user.id);
    if (result.verificationStatus === "rejected")
      return receiptJson(
        {
          code: "INVALID_FILE",
          message: request.headers.get("accept-language")?.startsWith("en")
            ? "The uploaded file failed validation. Payment was not submitted."
            : "فایل ارسال‌شده معتبر نیست؛ پرداخت برای بررسی ثبت نشد.",
        },
        422,
      );
    return receiptJson(result);
  } catch (error) {
    return receiptError(error, request);
  }
}
