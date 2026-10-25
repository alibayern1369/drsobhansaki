CREATE TABLE "receipt_cleanup_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"dry_run" boolean NOT NULL,
	"status" text NOT NULL,
	"scanned" integer DEFAULT 0 NOT NULL,
	"eligible" integer DEFAULT 0 NOT NULL,
	"deleted" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"blocked_reasons" jsonb,
	"error_code" text
);
--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "patient_id" uuid;--> statement-breakpoint
UPDATE "payment_receipts" AS r SET "patient_id" = a."patient_id" FROM "payment_submissions" AS p JOIN "appointments" AS a ON a."id" = p."appointment_id" WHERE r."submission_id" = p."id";--> statement-breakpoint
ALTER TABLE "payment_receipts" ALTER COLUMN "patient_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "provider" text DEFAULT 'legacy_s3' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "blob_pathname" text;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "original_filename" text DEFAULT 'receipt' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "verification_status" text DEFAULT 'under_review' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "deletion_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "deletion_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "last_deletion_error" text;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "next_deletion_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "retention_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "legal_retention_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "upload_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "token_issue_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "upload_idempotency_key" uuid;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD COLUMN "dispute_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD COLUMN "retention_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD COLUMN "legal_retention_until" timestamp with time zone;--> statement-breakpoint
UPDATE "payment_receipts" AS r SET "uploaded_at" = r."created_at", "verification_status" = p."status"::text FROM "payment_submissions" AS p WHERE r."submission_id" = p."id";--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipt_patient_idx" ON "payment_receipts" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "receipt_cleanup_idx" ON "payment_receipts" USING btree ("deletion_status","uploaded_at");--> statement-breakpoint
CREATE INDEX "receipt_payment_idx" ON "payment_receipts" USING btree ("submission_id");--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_blob_pathname_unique" UNIQUE("blob_pathname");--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_upload_idempotency_key_unique" UNIQUE("upload_idempotency_key");--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "receipt_size_limit" CHECK ("payment_receipts"."size_bytes">0 and "payment_receipts"."size_bytes"<=5242880);
