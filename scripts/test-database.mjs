import { spawnSync } from "node:child_process";
process.loadEnvFile(".env.local");
if (process.env.NEON_BRANCH !== "development" || !process.env.DATABASE_URL)
  throw new Error("A configured development database is required.");
const result = spawnSync(
  process.execPath,
  [
    "node_modules/tsx/dist/cli.mjs",
    "--test",
    "tests/database.test.ts",
    "tests/domain.test.ts",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      TEST_DATABASE_URL: process.env.DATABASE_URL,
      ALLOW_DB_TEST: "true",
    },
  },
);
process.exit(result.status ?? 1);
