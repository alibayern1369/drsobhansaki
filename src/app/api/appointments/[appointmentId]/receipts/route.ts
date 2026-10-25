import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { appointments, paymentReceipts, paymentSubmissions } from "@/db/schema";
import { requireUser, AppError } from "@/server/security";
import { receiptJson, receiptError } from "@/server/receipt-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const user = await requireUser();
    const { appointmentId } = await params;
    const id = z.uuid().parse(appointmentId);
    const [appointment] = await getDb()
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.patientId, user.id)));
    if (!appointment) throw new AppError(404, "NOT_FOUND");
    return receiptJson(
      await getDb()
        .select({
          id: paymentReceipts.id,
          originalFilename: paymentReceipts.originalFilename,
          uploadedAt: paymentReceipts.uploadedAt,
          verificationStatus: paymentReceipts.verificationStatus,
          deletionStatus: paymentReceipts.deletionStatus,
          scanStatus: paymentReceipts.scanStatus,
        })
        .from(paymentReceipts)
        .innerJoin(
          paymentSubmissions,
          eq(paymentSubmissions.id, paymentReceipts.paymentId),
        )
        .where(
          and(
            eq(paymentSubmissions.appointmentId, id),
            eq(paymentReceipts.patientId, user.id),
          ),
        )
        .orderBy(desc(paymentReceipts.uploadedAt))
        .limit(30),
    );
  } catch (error) {
    return receiptError(error, request);
  }
}
