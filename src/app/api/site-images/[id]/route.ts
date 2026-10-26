import { privateReceiptStorage } from "@/server/blob-store";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(id))
    return new Response(null, { status: 404 });
  try {
    // Only this intentionally public namespace is exposed. Receipt paths cannot be requested.
    const image = await privateReceiptStorage.get(`website-assets/${id}`);
    if (!image) return new Response(null, { status: 404 });
    return new Response(image.stream, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
