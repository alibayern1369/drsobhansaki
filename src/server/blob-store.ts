import "server-only";
import { get, del, BlobNotFoundError } from "@vercel/blob";
import type { PrivateReceiptStorage } from "@/lib/receipt-content";
import { AppError } from "./security";
export function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new AppError(503, "BLOB_NOT_CONFIGURED");
  return token;
}
export const privateReceiptStorage: PrivateReceiptStorage = {
  async get(pathname) {
    try {
      const result = await get(pathname, {
        access: "private",
        token: blobToken(),
        useCache: false,
        abortSignal: AbortSignal.timeout(15000),
      });
      if (!result || result.statusCode !== 200) return null;
      return {
        stream: result.stream,
        contentType: result.blob.contentType,
        size: result.blob.size,
      };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  },
  async del(pathname) {
    try {
      await del(pathname, {
        token: blobToken(),
        abortSignal: AbortSignal.timeout(6000),
      });
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error;
    }
  },
};
