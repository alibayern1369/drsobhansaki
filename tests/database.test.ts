import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
test(
  "development database connection and rollback-only write",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    assert.equal(
      process.env.ALLOW_DB_TEST,
      "true",
      "Explicit development database test authorization required",
    );
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "CREATE TEMP TABLE medical_connection_test (value integer not null) ON COMMIT DROP",
      );
      await client.query(
        "INSERT INTO medical_connection_test(value) VALUES($1)",
        [42],
      );
      const r = await client.query("SELECT value FROM medical_connection_test");
      assert.equal(r.rows[0].value, 42);
      await client.query("ROLLBACK");
    } finally {
      client.release();
      await pool.end();
    }
  },
);
