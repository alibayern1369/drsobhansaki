import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomInt } from "node:crypto";
process.loadEnvFile(".env.local");
if (process.env.NEON_BRANCH !== "development")
  throw new Error("Development branch required.");
let content = readFileSync(".env.local", "utf8");
function set(key, value, onlyWhenEmpty = false) {
  const pattern = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(pattern);
  if (onlyWhenEmpty && match && match[1].trim() && match[1].trim() !== '""')
    return;
  if (match)
    content = content.replace(pattern, () => `${key}=${JSON.stringify(value)}`);
  else content += `\n${key}=${JSON.stringify(value)}\n`;
}
for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]) {
  const url = new URL(process.env[key]);
  url.searchParams.set("sslmode", "verify-full");
  set(key, url.toString());
}
set("AUTH_SECRET", randomBytes(32).toString("hex"), true);
set("DEV_OTP_CODE", String(randomInt(100000, 1000000)), true);
writeFileSync(".env.local", content);
console.log(
  "Configured development TLS and missing local auth secrets; existing nonempty secrets preserved. No secret values printed.",
);
