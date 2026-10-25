import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  const locale = request.nextUrl.pathname.split("/")[1] === "en" ? "en" : "fa";
  const headers = new Headers(request.headers);
  headers.set("x-locale", locale);
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://blob.vercel-storage.com https://*.blob.vercel-storage.com${dev ? " ws:" : ""}; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  if (
    /^\/(fa|en)\/(admin|dashboard|login|booking)/.test(
      request.nextUrl.pathname,
    ) ||
    request.nextUrl.pathname.startsWith("/api/")
  )
    response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|fonts/|icon.svg).*)",
  ],
};
