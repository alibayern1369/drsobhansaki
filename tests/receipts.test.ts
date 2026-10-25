import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteReceiptObject,
  deletionBlockReason,
  DEFAULT_RECEIPT_POLICY,
  parseReceiptPolicy,
  receiptAccessAllowed,
  receiptPolicySchema,
  sanitizeReceiptFilename,
  type ReceiptDeletionCandidate,
} from "../src/lib/receipt-policy";
import {
  inspectPrivateReceipt,
  readReceiptBytes,
  type PrivateReceiptStorage,
} from "../src/lib/receipt-content";
import {
  receiptUploadGrant,
  receiptReviewTransition,
} from "../src/lib/receipt-upload";
import { validateReceipt } from "../src/lib/domain";
import { cronAuthorized } from "../src/lib/cron-auth";
import {
  generateClientTokenFromReadWriteToken,
  getPayloadFromClientToken,
} from "@vercel/blob/client";
const now = new Date("2026-10-25T10:00:00Z");
const policy = {
  enabled: true,
  dryRun: false,
  retentionDays: 7,
  mandatoryRetentionDays: 7,
  policyApproved: true,
};
function receipt(
  overrides: Partial<ReceiptDeletionCandidate> = {},
): ReceiptDeletionCandidate {
  return {
    id: "receipt-1",
    provider: "vercel_blob",
    blobPathname: "payment-receipts/payment-1/random-id",
    uploadedAt: new Date(now.getTime() - 8 * 86400000),
    verificationStatus: "approved",
    paymentStatus: "approved",
    submissionStatus: "approved",
    deletionStatus: "active",
    deletedAt: null,
    disputeActive: false,
    retentionHold: false,
    paymentRetentionHold: false,
    legalRetentionHold: false,
    retainedUntil: new Date(now.getTime() - 86400000),
    legalRetentionUntil: null,
    deletionAttempts: 0,
    ...overrides,
  };
}
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
function stream(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}
function storage(bytes = png, mime = "image/png"): PrivateReceiptStorage {
  return {
    get: async () => ({
      stream: stream(bytes),
      contentType: mime,
      size: bytes.length,
    }),
    del: async () => undefined,
  };
}
const grantInput = {
  receiptId: "receipt-1",
  patientId: "patient-1",
  actorId: "patient-1",
  pathname: "payment-receipts/payment-1/random-id",
  expectedPathname: "payment-receipts/payment-1/random-id",
  mimeType: "image/png",
  fileSize: png.length,
  expiresAt: new Date(now.getTime() + 600000),
  tokenIssueCount: 0,
  verificationStatus: "pending_upload",
  paymentStatus: "awaiting_payment",
  appointmentStatus: "awaiting_payment",
};
test("official SDK mints a path-scoped upload token locally without contacting Blob", async () => {
  const time = new Date();
  const grant = receiptUploadGrant(
    { ...grantInput, expiresAt: new Date(time.getTime() + 60000) },
    time,
  );
  const fakeToken = [
    "vercel",
    "blob",
    "rw",
    "unit-test-store",
    "not-a-real-secret",
  ].join("_");
  const token = await generateClientTokenFromReadWriteToken({
    ...grant,
    pathname: grantInput.pathname,
    token: fakeToken,
  });
  const decoded = getPayloadFromClientToken(token);
  assert.equal(decoded.pathname, grantInput.pathname);
  assert.equal(decoded.maximumSizeInBytes, png.length);
  assert.equal(decoded.allowOverwrite, false);
  assert.deepEqual(decoded.allowedContentTypes, ["image/png"]);
});
test("valid private upload is inspected from a server-resolved pathname", async () => {
  let read = "";
  const adapter = storage();
  adapter.get = async (path) => {
    read = path;
    return { stream: stream(png), contentType: "image/png", size: png.length };
  };
  const result = await inspectPrivateReceipt(adapter, {
    blobPathname: grantInput.pathname,
    mimeType: "image/png",
    fileSize: png.length,
  });
  assert.equal(read, grantInput.pathname);
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.fileSize, png.length);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});
test("spoofed image is rejected after private upload", async () => {
  await assert.rejects(
    () =>
      inspectPrivateReceipt(
        storage(new TextEncoder().encode("<script>"), "image/png"),
        {
          blobPathname: grantInput.pathname,
          mimeType: "image/png",
          fileSize: 8,
        },
      ),
    /INVALID_FILE_SIGNATURE/,
  );
});
test("oversized storage object is rejected before buffering", async () => {
  const adapter = storage();
  adapter.get = async () => ({
    stream: stream(png),
    contentType: "image/png",
    size: 5242881,
  });
  await assert.rejects(
    () =>
      inspectPrivateReceipt(adapter, {
        blobPathname: grantInput.pathname,
        mimeType: "image/png",
        fileSize: png.length,
      }),
    /INVALID_FILE_SIZE/,
  );
});
test("stream cannot exceed the upload limit even if metadata lies", async () => {
  await assert.rejects(
    () => readReceiptBytes(stream(new Uint8Array(5242881))),
    /INVALID_FILE_SIZE/,
  );
});
test("actual MIME and declared MIME must match", async () => {
  await assert.rejects(
    () =>
      inspectPrivateReceipt(storage(png, "application/pdf"), {
        blobPathname: grantInput.pathname,
        mimeType: "image/png",
        fileSize: png.length,
      }),
    /INVALID_FILE_SIGNATURE/,
  );
});
test("missing private upload is retryable, never accepted", async () => {
  await assert.rejects(
    () =>
      inspectPrivateReceipt(
        { get: async () => null, del: async () => undefined },
        {
          blobPathname: grantInput.pathname,
          mimeType: "image/png",
          fileSize: 8,
        },
      ),
    /BLOB_NOT_FOUND/,
  );
});
test("WebP signature is supported and mismatched MIME rejected", () => {
  const webp = new TextEncoder().encode("RIFF1234WEBPVP8X");
  assert.equal(validateReceipt(webp, "image/webp"), "image/webp");
  assert.throws(
    () => validateReceipt(webp, "image/png"),
    /INVALID_FILE_SIGNATURE/,
  );
});
test("upload token is limited to type, exact size, time and no overwrites", () => {
  const grant = receiptUploadGrant(grantInput, now);
  assert.deepEqual(grant.allowedContentTypes, ["image/png"]);
  assert.equal(grant.maximumSizeInBytes, png.length);
  assert.equal(grant.allowOverwrite, false);
  assert.equal(grant.addRandomSuffix, false);
  assert.equal(grant.validUntil, grantInput.expiresAt.getTime());
});
test("anonymous and cross-patient uploads are denied", () => {
  assert.throws(
    () => receiptUploadGrant({ ...grantInput, actorId: null }, now),
    /FORBIDDEN/,
  );
  assert.throws(
    () => receiptUploadGrant({ ...grantInput, actorId: "patient-2" }, now),
    /FORBIDDEN/,
  );
});
test("client cannot choose an arbitrary blob pathname", () => {
  assert.throws(
    () =>
      receiptUploadGrant(
        { ...grantInput, pathname: "somebody-else/receipt" },
        now,
      ),
    /FORBIDDEN/,
  );
});
test("expired and repeatedly issued upload grants are rejected", () => {
  assert.throws(
    () => receiptUploadGrant({ ...grantInput, expiresAt: now }, now),
    /UPLOAD_EXPIRED/,
  );
  assert.throws(
    () => receiptUploadGrant({ ...grantInput, tokenIssueCount: 3 }, now),
    /UPLOAD_EXPIRED/,
  );
});
test("final payments cannot receive new upload tokens", () => {
  assert.throws(
    () => receiptUploadGrant({ ...grantInput, paymentStatus: "approved" }, now),
    /INVALID_TRANSITION/,
  );
});
test("receipt acceptance goes under review and never approves payment", () => {
  assert.deepEqual(
    receiptReviewTransition("awaiting_payment", "awaiting_payment"),
    {
      appointmentStatus: "awaiting_verification",
      paymentStatus: "under_review",
      verificationStatus: "under_review",
    },
  );
  assert.throws(
    () => receiptReviewTransition("cancelled", "awaiting_payment"),
    /INVALID_TRANSITION/,
  );
});
test("patient can read only their own private receipt", () => {
  assert.equal(
    receiptAccessAllowed(
      { id: "patient-1", role: "patient", mfaVerifiedAt: null },
      "patient-1",
      now,
    ),
    true,
  );
  assert.equal(
    receiptAccessAllowed(
      { id: "patient-2", role: "patient", mfaVerifiedAt: null },
      "patient-1",
      now,
    ),
    false,
  );
  assert.equal(receiptAccessAllowed(null, "patient-1", now), false);
});
test("authorized doctor requires recent MFA to read other patients receipts", () => {
  assert.equal(
    receiptAccessAllowed(
      { id: "doctor", role: "doctor", mfaVerifiedAt: now },
      "patient-1",
      now,
    ),
    true,
  );
  assert.equal(
    receiptAccessAllowed(
      { id: "doctor", role: "doctor", mfaVerifiedAt: null },
      "patient-1",
      now,
    ),
    false,
  );
  assert.equal(
    receiptAccessAllowed(
      { id: "staff", role: "staff", mfaVerifiedAt: now },
      "patient-1",
      now,
    ),
    false,
  );
  assert.equal(
    receiptAccessAllowed(
      {
        id: "admin",
        role: "super_admin",
        mfaVerifiedAt: new Date(now.getTime() - 901000),
      },
      "patient-1",
      now,
    ),
    false,
  );
});
test("receipt older than seven full days can be eligible", () => {
  assert.equal(deletionBlockReason(receipt(), policy, now), null);
});
test("receipt younger than seven full days is protected at the boundary", () => {
  assert.equal(
    deletionBlockReason(
      receipt({ uploadedAt: new Date(now.getTime() - 7 * 86400000 + 1) }),
      policy,
      now,
    ),
    "too_young",
  );
  assert.equal(
    deletionBlockReason(
      receipt({ uploadedAt: new Date(now.getTime() - 7 * 86400000) }),
      policy,
      now,
    ),
    null,
  );
});
test("pending payment and pending receipt verification both prevent deletion", () => {
  assert.equal(
    deletionBlockReason(
      receipt({ paymentStatus: "under_review" }),
      policy,
      now,
    ),
    "verification_pending",
  );
  assert.equal(
    deletionBlockReason(
      receipt({ submissionStatus: "awaiting_payment" }),
      policy,
      now,
    ),
    "verification_pending",
  );
  assert.equal(
    deletionBlockReason(
      receipt({ verificationStatus: "pending_upload" }),
      policy,
      now,
    ),
    "verification_pending",
  );
});
test("disputed payments cannot be deleted", () => {
  assert.equal(
    deletionBlockReason(receipt({ disputeActive: true }), policy, now),
    "disputed",
  );
});
test("manual payment and receipt retention holds prevent deletion", () => {
  assert.equal(
    deletionBlockReason(receipt({ retentionHold: true }), policy, now),
    "retention_hold",
  );
  assert.equal(
    deletionBlockReason(receipt({ paymentRetentionHold: true }), policy, now),
    "retention_hold",
  );
});
test("legal holds, legal deadlines and mandatory minimums prevent deletion", () => {
  assert.equal(
    deletionBlockReason(receipt({ legalRetentionHold: true }), policy, now),
    "legal_hold",
  );
  assert.equal(
    deletionBlockReason(
      receipt({ legalRetentionUntil: new Date(now.getTime() + 1) }),
      policy,
      now,
    ),
    "retention_requirement",
  );
  assert.equal(
    deletionBlockReason(
      receipt(),
      { ...policy, mandatoryRetentionDays: 30 },
      now,
    ),
    "too_young",
  );
  assert.equal(
    deletionBlockReason(
      receipt({ retainedUntil: new Date(now.getTime() + 1) }),
      policy,
      now,
    ),
    "retention_requirement",
  );
});
test("unreviewed requirements and unsupported legacy providers fail closed", () => {
  assert.equal(
    deletionBlockReason(receipt(), DEFAULT_RECEIPT_POLICY, now),
    "retention_requirement_unreviewed",
  );
  assert.equal(
    deletionBlockReason(receipt({ provider: "legacy_s3" }), policy, now),
    "unsupported_provider",
  );
});
test("cleanup never deletes files in dry-run", async () => {
  let calls = 0;
  const result = await deleteReceiptObject(
    receipt(),
    policy,
    {
      del: async () => {
        calls++;
      },
    },
    { allowDelete: true, forceDryRun: true, now },
  );
  assert.equal(result.status, "would_delete");
  assert.equal(calls, 0);
});
test("unapproved policy or disabled deployment interlock cannot delete", async () => {
  let calls = 0;
  const adapter = {
    del: async () => {
      calls++;
    },
  };
  await deleteReceiptObject(
    receipt(),
    { ...policy, policyApproved: false },
    adapter,
    { allowDelete: true, now },
  );
  await deleteReceiptObject(receipt(), policy, adapter, {
    allowDelete: false,
    now,
  });
  assert.equal(calls, 0);
});
test("successful mocked deletion returns metadata update without removing financial records", async () => {
  let path = "";
  const result = await deleteReceiptObject(
    receipt(),
    policy,
    {
      del: async (p) => {
        path = p;
      },
    },
    { allowDelete: true, now },
  );
  assert.equal(result.status, "deleted");
  assert.equal(path, receipt().blobPathname);
  if (result.status === "deleted") {
    assert.equal(result.deletedAt, now);
    assert.equal(result.attempts, 1);
  }
});
test("already deleted receipts are idempotent and do not call storage", async () => {
  let calls = 0;
  const result = await deleteReceiptObject(
    receipt({ deletedAt: now, deletionStatus: "deleted" }),
    policy,
    {
      del: async () => {
        calls++;
      },
    },
    { allowDelete: true, now },
  );
  assert.equal(result.status, "blocked");
  assert.equal(calls, 0);
});
test("an already missing object is safe when adapter implements idempotent del", async () => {
  const result = await deleteReceiptObject(
    receipt(),
    policy,
    { del: async () => undefined },
    { allowDelete: true, now },
  );
  assert.equal(result.status, "deleted");
});
test("failed deletion records a safe error and a future retry time", async () => {
  const result = await deleteReceiptObject(
    receipt(),
    policy,
    {
      del: async () => {
        throw new Error("sensitive provider error");
      },
    },
    { allowDelete: true, now },
  );
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.error, "BLOB_DELETE_FAILED");
    assert.equal(result.attempts, 1);
    assert.ok(result.retryAt > now);
    assert.equal(
      deletionBlockReason(
        receipt({ nextDeletionAttemptAt: result.retryAt }),
        policy,
        now,
      ),
      "retry_not_due",
    );
  }
});
test("cron authentication rejects missing, wrong and malformed bearer tokens", () => {
  const secret = "a".repeat(64);
  assert.equal(cronAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(cronAuthorized(null, secret), false);
  assert.equal(cronAuthorized("Bearer wrong", secret), false);
  assert.equal(cronAuthorized(`Bearer ${secret}`, undefined), false);
  assert.equal(cronAuthorized(`Basic ${secret}`, secret), false);
  assert.equal(cronAuthorized(`Bearer ${"ب".repeat(64)}`, secret), false);
});
test("retention settings cannot shorten mandatory minimum below seven days", () => {
  assert.equal(
    receiptPolicySchema.safeParse({ ...policy, retentionDays: 6 }).success,
    false,
  );
  assert.equal(
    receiptPolicySchema.safeParse({ ...policy, mandatoryRetentionDays: 0 })
      .success,
    false,
  );
  assert.equal(
    receiptPolicySchema.safeParse({ ...policy, mandatoryRetentionDays: null })
      .success,
    false,
  );
  assert.equal(parseReceiptPolicy({ enabled: true }).enabled, false);
});
test("original filenames do not become filesystem paths or response headers", () => {
  assert.equal(sanitizeReceiptFilename("../../receipt\r\n.pdf"), "receipt.pdf");
  assert.equal(
    sanitizeReceiptFilename("C:\\fakepath\\receipt.png"),
    "receipt.png",
  );
});
