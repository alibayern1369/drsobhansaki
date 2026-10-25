import { cronAuthorized } from "@/lib/cron-auth";
import { runReceiptCleanup } from "@/server/receipt-cleanup";
import { receiptJson } from "@/server/receipt-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (
    !cronAuthorized(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  )
    return receiptJson({ error: "Unauthorized" }, 401);
  try {
    const summary = await runReceiptCleanup();
    console.info("receipt_cleanup", summary);
    return receiptJson(summary);
  } catch {
    console.error("receipt_cleanup_failed");
    return receiptJson({ error: "Receipt cleanup failed" }, 503);
  }
}
