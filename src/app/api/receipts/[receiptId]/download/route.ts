import { z } from "zod";
import { downloadReceipt } from "@/server/storage";
import { receiptError } from "@/server/receipt-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  try {
    const { receiptId } = await params;
    const response = await downloadReceipt(z.uuid().parse(receiptId));
    if (new URL(request.url).searchParams.get("view") === "1" && response.ok)
      response.headers.set("Content-Disposition", "inline");
    return response;
  } catch (error) {
    return receiptError(error, request);
  }
}
