import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomInt } from "node:crypto";
import { Pool } from "pg";
const enabled =
  !!process.env.TEST_DATABASE_URL &&
  process.env.ALLOW_DB_TEST === "true" &&
  process.env.NEON_BRANCH === "development";
test(
  "receipt metadata migration preserves payment history on soft deletion",
  { skip: !enabled },
  async () => {
    const pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const user = (
        await c.query("insert into users(phone) values($1) returning id", [
          `09000${String(randomInt(0, 1000000)).padStart(6, "0")}`,
        ])
      ).rows[0];
      const type = (
        await c.query(
          "insert into consultation_types(key,name,price_rial,duration_minutes) values($1,$2,$3,$4) returning id",
          [
            `receipt-test-${randomUUID()}`,
            JSON.stringify({ en: "Synthetic test" }),
            100000,
            20,
          ],
        )
      ).rows[0];
      const a = (
        await c.query(
          "insert into appointments(patient_id,consultation_type_id,type_snapshot,price_rial,duration_minutes,scheduling_mode,status,payment_status,tracking_code,idempotency_key,expires_at,consent_at) values($1,$2,$3,100000,20,'doctor','awaiting_scheduling','approved',$4,$5,now()+interval '1 day',now()) returning id",
          [user.id, type.id, "{}", randomUUID(), randomUUID()],
        )
      ).rows[0];
      const bank = (
        await c.query(
          "insert into bank_accounts(bank_name,holder_name,card_number) values($1,$2,$3) returning id",
          ["SYNTHETIC TEST", "SYNTHETIC TEST", "0000000000000000"],
        )
      ).rows[0];
      const payment = (
        await c.query(
          "insert into payment_submissions(appointment_id,bank_account_id,status) values($1,$2,'approved') returning id",
          [a.id, bank.id],
        )
      ).rows[0];
      const pathname = `payment-receipts/${payment.id}/${randomUUID()}`;
      const receipt = (
        await c.query(
          "insert into payment_receipts(submission_id,patient_id,provider,object_key,blob_pathname,original_filename,mime_type,size_bytes,sha256,retained_until,verification_status,uploaded_at) values($1,$2,'vercel_blob',$3,$3,'synthetic.png','image/png',8,$4,now()-interval '1 day','approved',now()-interval '8 days') returning id,retention_hold,legal_retention_hold,deletion_status",
          [payment.id, user.id, pathname, "0".repeat(64)],
        )
      ).rows[0];
      assert.equal(receipt.retention_hold, false);
      assert.equal(receipt.legal_retention_hold, false);
      assert.equal(receipt.deletion_status, "active");
      await c.query(
        "update payment_receipts set deletion_status='deleted',deleted_at=now(),deletion_attempts=deletion_attempts+1 where id=$1",
        [receipt.id],
      );
      const persisted = await c.query(
        "select (select count(*)::int from appointments where id=$1) as appointments,(select count(*)::int from payment_submissions where id=$2) as payments,(select deletion_status from payment_receipts where id=$3) as deletion_status",
        [a.id, payment.id, receipt.id],
      );
      assert.deepEqual(persisted.rows[0], {
        appointments: 1,
        payments: 1,
        deletion_status: "deleted",
      });
      await c.query("SAVEPOINT invalid_size");
      await assert.rejects(
        () =>
          c.query(
            "update payment_receipts set size_bytes=5242881 where id=$1",
            [receipt.id],
          ),
        (error: unknown) => (error as { code: string }).code === "23514",
      );
      await c.query("ROLLBACK TO SAVEPOINT invalid_size");
      await c.query("ROLLBACK");
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      c.release();
      await pool.end();
    }
  },
);
test(
  "Postgres cleanup advisory ownership prevents overlapping workers",
  { skip: !enabled },
  async () => {
    const pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 10000,
    });
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await first.query("BEGIN");
      await second.query("BEGIN");
      const key = `receipt-cleanup-test:${randomUUID()}`;
      const claim =
        "select pg_try_advisory_xact_lock(hashtext($1)) as acquired";
      assert.equal((await first.query(claim, [key])).rows[0].acquired, true);
      assert.equal((await second.query(claim, [key])).rows[0].acquired, false);
      await first.query("ROLLBACK");
      assert.equal((await second.query(claim, [key])).rows[0].acquired, true);
      await second.query("ROLLBACK");
    } finally {
      await first.query("ROLLBACK").catch(() => undefined);
      await second.query("ROLLBACK").catch(() => undefined);
      first.release();
      second.release();
      await pool.end();
    }
  },
);
