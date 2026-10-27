import test from "node:test";
import assert from "node:assert/strict";
import { patientFetch } from "../src/lib/patient-fetch";
test("lost read response is retried once", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++calls === 1) throw new TypeError("Failed to fetch");
    return new Response("ok");
  });
  assert.equal(
    await (await patientFetch("https://fixture.invalid/config")).text(),
    "ok",
  );
  assert.equal(calls, 2);
});
test("transport retry preserves the exact booking idempotency key and body", async (t) => {
  const options = {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      price: 10,
    }),
  };
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      assert.equal(init, options);
      if (++calls === 1) throw new TypeError("Failed to fetch");
      return new Response("ok");
    },
  );
  await patientFetch("https://fixture.invalid/appointments", options);
  assert.equal(calls, 2);
});
test("OTP and other unkeyed writes are never automatically sent twice", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    patientFetch("https://fixture.invalid/otp", {
      method: "POST",
      body: JSON.stringify({ phone: "09123456789" }),
    }),
  );
  assert.equal(calls, 1);
});
test("server validation failures are returned without a replay", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response("conflict", { status: 409 });
  });
  assert.equal(
    (await patientFetch("https://fixture.invalid/config")).status,
    409,
  );
  assert.equal(calls, 1);
});
