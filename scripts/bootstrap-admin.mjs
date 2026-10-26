import fs from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { Pool } from "pg";
process.loadEnvFile(".env.local");
if (process.env.NEON_BRANCH !== "development")
  throw new Error("Use the reviewed development database for bootstrap.");
const phone = process.env.ADMIN_BOOTSTRAP_PHONE;
if (!/^09\d{9}$/.test(phone || ""))
  throw new Error("Set ADMIN_BOOTSTRAP_PHONE to the owner's number.");
const file = ".vercel/admin-login.json";
const existing = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, "utf8"))
  : null;
const username = process.env.ADMIN_BOOTSTRAP_USERNAME || "drsaki.admin";
if (existing && existing.username !== username)
  throw new Error("Existing enrollment belongs to a different username.");
const password = existing?.password || randomBytes(18).toString("base64url");
const salt = randomBytes(16).toString("hex");
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
const client = await pool.connect();
try {
  await client.query("begin");
  const user = (
    await client.query(
      "insert into users(phone,role) values($1,'super_admin') on conflict(phone) do update set role='super_admin',disabled=false,updated_at=now() returning id",
      [phone],
    )
  ).rows[0];
  const found = await client.query(
    "select username from admin_credentials where user_id=$1",
    [user.id],
  );
  if (found.rowCount && !existing)
    throw new Error(
      "Existing credentials will not be overwritten without their saved enrollment.",
    );
  await client.query(
    "insert into admin_credentials(user_id,username,password_hash) values($1,$2,$3) on conflict(user_id) do update set password_hash=$3,updated_at=now()",
    [user.id, username, passwordHash],
  );
  await client.query("delete from sessions where user_id=$1", [user.id]);
  await client.query(
    "insert into audit_logs(actor_id,action,entity_type,entity_id) values($1,'admin.password_bootstrap','user',$2)",
    [user.id, user.id],
  );
  fs.mkdirSync(".vercel", { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ username, password, userId: user.id, phone }, null, 2),
  );
  await client.query("commit");
  console.log(
    "Administrator credentials prepared; private enrollment saved in .vercel/admin-login.json. Password not printed.",
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
