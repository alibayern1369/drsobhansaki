import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
const execute = promisify(execFile);
// Optional transport workaround for this Windows host's TLS errors. This sends
// the real SDK request, scoped client token and bytes to the real Blob service;
// neither the provider response nor the uploaded object is mocked.
export async function curlUploadTransport(page: Page, selectedFile: Buffer) {
  if (process.env.PORTAL_TEST_CURL_UPLOAD_PROXY !== "true") return;
  await page.route(
    (url) =>
      url.origin === "https://vercel.com" && url.pathname === "/api/blob/",
    async (route) => {
      const request = route.request();
      const prefix = resolve(
        ".vercel",
        `portal-upload-transport-${randomUUID()}`,
      );
      const files = [
        prefix + ".headers",
        prefix + ".body",
        prefix + ".response",
        prefix + ".response-headers",
      ];
      await mkdir(resolve(".vercel"), { recursive: true });
      try {
        const headers = Object.entries(request.headers())
          .filter(
            ([key]) =>
              ![
                "host",
                "content-length",
                "accept-encoding",
                "cookie",
                "connection",
              ].includes(key.toLowerCase()),
          )
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
        await writeFile(files[0], headers);
        // Chromium does not reliably expose binary File request bodies to routing.
        // Send the exact same fixture bytes assigned to the browser's file input.
        await writeFile(
          files[1],
          request.method() === "PUT"
            ? selectedFile
            : request.postDataBuffer() || Buffer.alloc(0),
        );
        const args = [
          "--silent",
          "--show-error",
          "--http1.1",
          "--max-time",
          "45",
          "--request",
          request.method(),
          "--header",
          `@${files[0]}`,
          "--data-binary",
          `@${files[1]}`,
          "--dump-header",
          files[3],
          "--output",
          files[2],
          "--write-out",
          "%{http_code}",
          request.url(),
        ];
        const { stdout } = await execute(
          process.platform === "win32" ? "curl.exe" : "curl",
          args,
          { maxBuffer: 512000 },
        );
        const responseHeaders: Record<string, string> = {};
        for (const line of (await readFile(files[3], "utf8")).split(/\r?\n/)) {
          const colon = line.indexOf(":");
          if (colon < 1) continue;
          const key = line.slice(0, colon).toLowerCase();
          if (
            ![
              "content-length",
              "transfer-encoding",
              "content-encoding",
              "set-cookie",
            ].includes(key)
          )
            responseHeaders[key] = line.slice(colon + 1).trim();
        }
        await route.fulfill({
          status: Number(stdout.trim()),
          headers: responseHeaders,
          body: await readFile(files[2]),
        });
      } catch {
        await route.abort("connectionfailed");
      } finally {
        await Promise.all(
          files.map((file) => unlink(file).catch(() => undefined)),
        );
      }
    },
  );
}
