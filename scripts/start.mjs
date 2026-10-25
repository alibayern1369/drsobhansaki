import { cpSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const root = process.cwd();
if (existsSync(resolve(root, ".env.local")))
  process.loadEnvFile(resolve(root, ".env.local"));
const standalone = resolve(root, ".next/standalone");
if (!existsSync(resolve(standalone, "server.js")))
  throw new Error("Run npm run build before npm start.");
mkdirSync(resolve(standalone, ".next"), { recursive: true });
cpSync(resolve(root, ".next/static"), resolve(standalone, ".next/static"), {
  recursive: true,
});
cpSync(resolve(root, "public"), resolve(standalone, "public"), {
  recursive: true,
});
const hostnameIndex = process.argv.indexOf("--hostname");
const hostname =
  hostnameIndex >= 0
    ? process.argv[hostnameIndex + 1]
    : process.env.HOSTNAME || "127.0.0.1";
const child = spawn(process.execPath, [resolve(standalone, "server.js")], {
  cwd: standalone,
  stdio: "inherit",
  env: { ...process.env, HOSTNAME: hostname, PORT: process.env.PORT || "3000" },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
