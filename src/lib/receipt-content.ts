import { createHash } from "node:crypto";
import { validateReceipt } from "./domain";
import { MAX_RECEIPT_BYTES } from "./receipt-policy";
export type PrivateBlobContent = {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
};
export interface PrivateReceiptStorage {
  get: (pathname: string) => Promise<PrivateBlobContent | null>;
  del: (pathname: string) => Promise<void>;
}
export async function readReceiptBytes(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RECEIPT_BYTES) {
        await reader.cancel();
        throw new Error("INVALID_FILE_SIZE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function inspectPrivateReceipt(
  storage: PrivateReceiptStorage,
  expected: { blobPathname: string; mimeType: string; fileSize: number },
) {
  const object = await storage.get(expected.blobPathname);
  if (!object) throw new Error("BLOB_NOT_FOUND");
  if (object.size > MAX_RECEIPT_BYTES || object.size !== expected.fileSize) {
    await object.stream.cancel();
    throw new Error("INVALID_FILE_SIZE");
  }
  if (object.contentType !== expected.mimeType) {
    await object.stream.cancel();
    throw new Error("INVALID_FILE_SIGNATURE");
  }
  const bytes = await readReceiptBytes(object.stream);
  if (bytes.byteLength !== expected.fileSize)
    throw new Error("INVALID_FILE_SIZE");
  const mimeType = validateReceipt(bytes, expected.mimeType);
  return {
    mimeType,
    fileSize: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
