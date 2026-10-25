import { MAX_RECEIPT_BYTES, RECEIPT_MIME_TYPES } from "./receipt-policy";
export function receiptUploadGrant(
  input: {
    receiptId: string;
    patientId: string;
    actorId: string | null;
    pathname: string;
    expectedPathname: string | null;
    mimeType: string;
    fileSize: number;
    expiresAt: Date | null;
    tokenIssueCount: number;
    verificationStatus: string;
    paymentStatus: string;
    appointmentStatus: string;
  },
  now = new Date(),
) {
  if (!input.actorId || input.actorId !== input.patientId)
    throw new Error("FORBIDDEN");
  if (
    input.pathname !== input.expectedPathname ||
    !input.pathname.startsWith("payment-receipts/")
  )
    throw new Error("FORBIDDEN");
  if (
    input.verificationStatus !== "pending_upload" ||
    !input.expiresAt ||
    input.expiresAt <= now ||
    input.tokenIssueCount >= 3
  )
    throw new Error("UPLOAD_EXPIRED");
  if (
    ![
      "awaiting_payment",
      "rejected",
      "additional_information_required",
    ].includes(input.paymentStatus) ||
    !["awaiting_payment", "awaiting_verification"].includes(
      input.appointmentStatus,
    )
  )
    throw new Error("INVALID_TRANSITION");
  if (
    !Number.isInteger(input.fileSize) ||
    input.fileSize <= 0 ||
    input.fileSize > MAX_RECEIPT_BYTES ||
    !RECEIPT_MIME_TYPES.includes(
      input.mimeType as (typeof RECEIPT_MIME_TYPES)[number],
    )
  )
    throw new Error("INVALID_INPUT");
  return {
    allowedContentTypes: [input.mimeType],
    maximumSizeInBytes: input.fileSize,
    validUntil: input.expiresAt.getTime(),
    addRandomSuffix: false,
    allowOverwrite: false,
    tokenPayload: JSON.stringify({ receiptId: input.receiptId }),
  };
}
export function receiptReviewTransition(
  appointmentStatus: string,
  paymentStatus: string,
) {
  if (
    !["awaiting_payment", "awaiting_verification"].includes(
      appointmentStatus,
    ) ||
    ![
      "awaiting_payment",
      "rejected",
      "additional_information_required",
    ].includes(paymentStatus)
  )
    throw new Error("INVALID_TRANSITION");
  return {
    appointmentStatus: "awaiting_verification" as const,
    paymentStatus: "under_review" as const,
    verificationStatus: "under_review" as const,
  };
}
