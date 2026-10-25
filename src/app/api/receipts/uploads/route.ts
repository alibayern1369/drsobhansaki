import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { authorizeReceiptUpload, completeReceipt } from "@/server/storage";
import { blobToken } from "@/server/blob-store";
import { AppError, checkOrigin, requireUser } from "@/server/security";
import { receiptJson, receiptError, smallJson } from "@/server/receipt-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = (await smallJson(request)) as HandleUploadBody;
    if (
      !body ||
      !["blob.generate-client-token", "blob.upload-completed"].includes(
        body.type,
      )
    )
      throw new AppError(400, "INVALID_INPUT");
    if (body.type === "blob.generate-client-token") {
      await checkOrigin(request);
      await requireUser();
    }
    const result = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        if (multipart) throw new AppError(400, "INVALID_INPUT");
        const data = z
          .object({ receiptId: z.uuid() })
          .parse(JSON.parse(clientPayload || "{}"));
        return authorizeReceiptUpload(data.receiptId, pathname);
      },
      onUploadCompleted: async ({ tokenPayload }) => {
        const data = z
          .object({ receiptId: z.uuid() })
          .parse(JSON.parse(tokenPayload || "{}"));
        await completeReceipt(data.receiptId);
      },
    });
    return receiptJson(result);
  } catch (error) {
    return receiptError(error, request);
  }
}
