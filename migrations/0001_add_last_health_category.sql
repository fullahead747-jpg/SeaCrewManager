ALTER TABLE "documents" ALTER COLUMN "expiry_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_settings" ALTER COLUMN "recipient_email" SET DEFAULT 'admin@offing.biz, management@fullahead.in';--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "last_health_category" text;--> statement-breakpoint
ALTER TABLE "crew_members" ADD COLUMN "coc_not_applicable" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "critical_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "upcoming_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "attention_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "scanned_documents" ADD COLUMN "extracted_issuing_authority" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "otp" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "otp_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token_expiry" timestamp;