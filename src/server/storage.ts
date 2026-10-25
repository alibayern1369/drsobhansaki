import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID, createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appointments,
  auditLogs,
  bankAccounts,
  paymentReceipts,
  paymentSubmissions,
  notifications,
  appointmentStatusHistory,
} from "@/db/schema";
import { validateReceipt } from "@/lib/domain";
import { AppError, requireUser } from "./security";
function storage() {
  if (
    !process.env.S3_ENDPOINT ||
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY ||
    !process.env.S3_BUCKET
  )
    throw new AppError(503, "STORAGE_NOT_CONFIGURED");
  return {
    client: new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    }),
    bucket: process.env.S3_BUCKET,
  };
}
export async function uploadReceipt(
  appointmentId: string,
  bankAccountId: string,
  file: File,
) {
  const user = await requireUser();
  if (file.size > 5 * 1024 * 1024) throw new AppError(400, "INVALID_FILE_SIZE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = validateReceipt(bytes, file.type);
  const db = getDb();
  const [a] = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.patientId, user.id),
      ),
    );
  if (!a) throw new AppError(404, "NOT_FOUND");
  if (
    ![
      "awaiting_payment",
      "rejected",
      "additional_information_required",
    ].includes(a.paymentStatus)
  )
    throw new AppError(409, "INVALID_TRANSITION");
  const [bank] = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(
      and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.enabled, true)),
    );
  if (!bank) throw new AppError(400, "BANK_ACCOUNT_UNAVAILABLE");
  const objectKey = `receipts/${randomUUID()}`;
  const { client, bucket } = storage();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: mime,
      ContentDisposition: "attachment",
      ServerSideEncryption: "AES256",
    }),
  );
  try {
    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, a.id))
        .for("update");
      if (
        ![
          "awaiting_payment",
          "rejected",
          "additional_information_required",
        ].includes(locked.paymentStatus) ||
        ["cancelled", "expired"].includes(locked.status)
      )
        throw new AppError(409, "INVALID_TRANSITION");
      const [submission] = await tx
        .insert(paymentSubmissions)
        .values({ appointmentId: a.id, bankAccountId, status: "under_review" })
        .returning();
      const [receipt] = await tx
        .insert(paymentReceipts)
        .values({
          submissionId: submission.id,
          objectKey,
          mimeType: mime,
          sizeBytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          scanStatus: "unscanned",
          retainedUntil: new Date(Date.now() + 180 * 86400000),
        })
        .returning({ id: paymentReceipts.id });
      await tx
        .update(appointments)
        .set({
          paymentStatus: "under_review",
          status: "awaiting_verification",
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, a.id));
      await tx.insert(appointmentStatusHistory).values({
        appointmentId: a.id,
        actorId: user.id,
        fromState: locked.status,
        toState: "awaiting_verification",
      });
      await tx.insert(notifications).values({
        userId: user.id,
        appointmentId: a.id,
        event: "receipt_submitted",
        dedupeKey: `receipt:${receipt.id}`,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "receipt.upload",
        entityType: "receipt",
        entityId: receipt.id,
      });
      return receipt;
    });
  } catch (e) {
    await client
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
      .catch(() => undefined);
    throw e;
  }
}
export async function receiptUrl(id: string) {
  const user = await requireUser();
  const [r] = await getDb()
    .select({
      key: paymentReceipts.objectKey,
      patientId: appointments.patientId,
      mime: paymentReceipts.mimeType,
    })
    .from(paymentReceipts)
    .innerJoin(
      paymentSubmissions,
      eq(paymentSubmissions.id, paymentReceipts.submissionId),
    )
    .innerJoin(
      appointments,
      eq(appointments.id, paymentSubmissions.appointmentId),
    )
    .where(eq(paymentReceipts.id, id));
  if (!r) throw new AppError(404, "NOT_FOUND");
  if (user.id !== r.patientId) {
    await requireUser(true);
    if (!["doctor", "super_admin"].includes(user.role))
      throw new AppError(403, "FORBIDDEN");
  }
  const { client, bucket } = storage();
  await getDb().insert(auditLogs).values({
    actorId: user.id,
    action: "receipt.access",
    entityType: "receipt",
    entityId: id,
  });
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: r.key,
      ResponseContentDisposition: "attachment",
      ResponseContentType: r.mime,
    }),
    { expiresIn: 60 },
  );
}
