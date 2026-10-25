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
    return await downloadReceipt(z.uuid().parse(receiptId));
  } catch (error) {
    return receiptError(error, request);
  }
}
