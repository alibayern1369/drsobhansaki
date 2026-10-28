import test from "node:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Client } from "pg";
import * as schema from "../src/db/schema";
import { archiveBankAccount } from "../src/server/bank-accounts";
function database(
  options: { receipts?: boolean; missing?: boolean; failAudit?: boolean } = {},
) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const client = {
    async query(query: { text: string }, params: unknown[] = []) {
      queries.push({ sql: query.text, params });
      if (
        query.text.startsWith("select") &&
        query.text.includes('"bank_accounts"')
      )
        return { rows: options.missing ? [] : [["bank-id"]] };
      if (
        query.text.startsWith("select") &&
        query.text.includes('"payment_submissions"')
      )
        return { rows: options.receipts ? [["payment-id"]] : [] };
      if (
        query.text.startsWith('insert into "audit_logs"') &&
        options.failAudit
      )
        throw new Error("audit unavailable");
      return { rows: [] };
    },
  };
  return { db: drizzle(client as unknown as Client, { schema }), queries };
}
for (const receipts of [false, true])
  test(`archiving bank with receipts=${receipts} hides the card without deleting payment history`, async () => {
    const { db, queries } = database({ receipts });
    assert.deepEqual(await archiveBankAccount(db, "bank-id", "actor-id"), {
      retained: receipts,
    });
    const update = queries.find((q) =>
      q.sql.startsWith('update "bank_accounts"'),
    )!;
    assert.match(update.sql, /"deleted_at" = \$/);
    assert.match(update.sql, /"enabled" = \$/);
    const enabledParam =
      Number(update.sql.match(/"enabled" = \$(\d+)/)![1]) - 1;
    assert.equal(update.params[enabledParam], false);
    assert.ok(queries.some((q) => q.sql.includes("for update")));
    assert.ok(
      queries.some(
        (q) =>
          q.sql.startsWith('insert into "audit_logs"') &&
          q.params.includes("bank.delete"),
      ),
    );
    assert.ok(!queries.some((q) => q.sql.startsWith("delete")));
    assert.equal(queries.at(-1)?.sql, "commit");
  });
test("missing bank cannot create a deletion audit", async () => {
  const { db, queries } = database({ missing: true });
  assert.equal(await archiveBankAccount(db, "missing", "actor-id"), null);
  assert.ok(
    !queries.some(
      (q) => q.sql.startsWith("update") || q.sql.startsWith("insert"),
    ),
  );
});
test("audit failure rolls back bank archival", async () => {
  const { db, queries } = database({ failAudit: true });
  await assert.rejects(() => archiveBankAccount(db, "bank-id", "actor-id"));
  assert.equal(queries.at(-1)?.sql, "rollback");
  assert.ok(!queries.some((q) => q.sql === "commit"));
});
