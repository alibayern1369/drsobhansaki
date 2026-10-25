import { test, expect } from "@playwright/test";
const id = "10000000-0000-4000-8000-000000000001";
test("anonymous receipt download and metadata require authentication", async ({
  request,
}) => {
  for (const path of [
    `/api/receipts/${id}`,
    `/api/receipts/${id}/download`,
    `/api/appointments/${id}/receipts`,
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
test("anonymous client upload token is rejected before storage is called", async ({
  request,
  baseURL,
}) => {
  const response = await request.post("/api/receipts/uploads", {
    headers: { Origin: process.env.E2E_SITE_ORIGIN || baseURL! },
    data: {
      type: "blob.generate-client-token",
      payload: {
        pathname: `payment-receipts/${id}/${id}`,
        multipart: false,
        clientPayload: JSON.stringify({ receiptId: id }),
      },
    },
  });
  expect(response.status()).toBe(401);
});
test("cleanup endpoint rejects unauthorized requests without running cleanup", async ({
  request,
}) => {
  for (const authorization of ["", "Bearer wrong-secret"]) {
    const r = await request.get("/api/cron/cleanup-receipts", {
      headers: authorization ? { Authorization: authorization } : {},
    });
    expect(r.status()).toBe(401);
    expect(r.headers()["cache-control"]).toContain("no-store");
  }
});
test("storage policy and retention holds require an authorized administrator", async ({
  request,
}) => {
  const policy = await request.get("/api/admin/receipt-storage");
  expect(policy.status()).toBe(401);
  const read = await request.get(
    `/api/receipts/${id}/download?pathname=untrusted-file.pdf`,
  );
  expect(read.status()).toBe(401);
});
