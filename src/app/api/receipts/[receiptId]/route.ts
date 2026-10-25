import { z } from "zod";
import { receiptStatus } from "@/server/storage";
import { receiptJson, receiptError } from "@/server/receipt-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  try {
    const { receiptId } = await params;
    const status = await receiptStatus(z.uuid().parse(receiptId));
    return receiptJson({
      ...status,
      url: `/api/receipts/${status.id}/download`,
    });
  } catch (error) {
    return receiptError(error, request);
  }
}
