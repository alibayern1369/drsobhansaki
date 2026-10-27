// Runs the real application against an explicitly supplied isolated database branch.
// It never falls back to DATABASE_URL and never sends an SMS.
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
if (
  !process.env.PORTAL_TEST_DATABASE_URL_FILE ||
  process.env.PORTAL_TEST_ISOLATED !== "true"
)
  throw new Error("An isolated test branch is required");
process.loadEnvFile(".env.local");
const database = readFileSync(process.env.PORTAL_TEST_DATABASE_URL_FILE, "utf8")
  .replace(/^\uFEFF/, "")
  .trim();
if (
  database === process.env.DATABASE_URL ||
  new URL(database).hostname.replace("-pooler", "") ===
    new URL(process.env.DATABASE_URL).hostname.replace("-pooler", "")
)
  throw new Error("Test branch must differ from the application database");
// Upload integration tests need a private Blob token supplied through the environment.
const child = spawn(
  process.execPath,
  ["scripts/start.mjs", "--hostname", "127.0.0.1"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: database,
      DATABASE_URL_UNPOOLED: database,
      SMS_PROVIDER: "unconfigured-test",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      PORT: "3000",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
