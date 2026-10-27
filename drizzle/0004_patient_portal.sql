ALTER TABLE "notifications" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD COLUMN "transaction_reference" varchar(100);