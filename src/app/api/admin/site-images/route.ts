import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import {
  requireUser,
  checkOrigin,
  AppError,
  rateLimit,
} from "@/server/security";
import { blobToken } from "@/server/blob-store";
import { validateReceipt } from "@/lib/domain";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await checkOrigin(request);
    const user = await requireUser(true);
    if (!["doctor", "super_admin"].includes(user.role))
      throw new AppError(403, "FORBIDDEN");
    await rateLimit(`site-image:${user.id}`, 30, 900);
    const size = Number(request.headers.get("content-length"));
    if (size > 4 * 1024 * 1024) throw new AppError(413, "IMAGE_TOO_LARGE");
    const type = request.headers.get("content-type") || "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(type))
      throw new AppError(400, "INVALID_IMAGE");
    // Read with an enforced limit even when Content-Length is absent or incorrect.
    const reader = request.body?.getReader();
    if (!reader) throw new AppError(400, "INVALID_IMAGE");
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > 4 * 1024 * 1024) {
          await reader.cancel();
          throw new AppError(413, "IMAGE_TOO_LARGE");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks);
    const ext =
      type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
    const id = `${randomUUID()}.${ext}`;
    validateReceipt(bytes, type);
    await put(`website-assets/${id}`, bytes, {
      access: "private",
      token: blobToken(),
      contentType: type,
      addRandomSuffix: false,
    });
    await getDb().insert(auditLogs).values({
      actorId: user.id,
      action: "website.image_upload",
      entityType: "website_image",
      entityId: id,
    });
    return Response.json(
      { url: `/api/site-images/${id}` },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof AppError && error.code === "BLOB_NOT_CONFIGURED"
            ? "اتصال فضای ذخیره‌سازی تصاویر در این محیط تنظیم نشده است."
            : error instanceof AppError && error.status === 413
              ? "حداکثر حجم عکس ۴ مگابایت است."
              : "آپلود انجام نشد. عکس JPG، PNG یا WebP معتبر انتخاب کنید و دسترسی خود را بررسی کنید.",
      },
      { status: error instanceof AppError ? error.status : 400 },
    );
  }
}
