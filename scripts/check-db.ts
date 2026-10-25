import { Pool } from "pg";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(
    "select current_database() as database, now() as time",
  );
  console.log({ connected: !!result.rows[0], time: result.rows[0].time });
} finally {
  await pool.end();
}
