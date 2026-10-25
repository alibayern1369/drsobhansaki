import { z } from "zod";
import { checkOrigin } from "@/server/security";
import { prepareReceipt } from "@/server/storage";
import { receiptJson, receiptError, smallJson } from "@/server/receipt-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    await checkOrigin(request);
    const { appointmentId } = await params;
    return receiptJson(
      await prepareReceipt(
        z.uuid().parse(appointmentId),
        await smallJson(request),
      ),
      201,
    );
  } catch (error) {
    return receiptError(error, request);
  }
}
