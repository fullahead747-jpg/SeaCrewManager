CREATE TABLE "activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"user_id" varchar,
	"username" text NOT NULL,
	"user_role" text NOT NULL,
	"description" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crew_member_id" varchar NOT NULL,
	"vessel_id" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"duration_days" integer,
	"salary" integer,
	"currency" text DEFAULT 'USD',
	"status" text DEFAULT 'active' NOT NULL,
	"contract_type" text DEFAULT 'SEA' NOT NULL,
	"contract_number" text,
	"file_path" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crew_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"nationality" text NOT NULL,
	"date_of_birth" timestamp NOT NULL,
	"rank" text NOT NULL,
	"phone_number" text,
	"email" text,
	"emergency_contact" jsonb,
	"current_vessel_id" varchar,
	"last_vessel_id" varchar,
	"status" text DEFAULT 'onBoard' NOT NULL,
	"sign_off_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crew_rotations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crew_member_id" varchar NOT NULL,
	"vessel_id" varchar NOT NULL,
	"join_date" timestamp NOT NULL,
	"leave_date" timestamp,
	"rotation_type" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_access_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_for" varchar(50) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "document_access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "document_policies" (
	"document_type" varchar(50) PRIMARY KEY NOT NULL,
	"warning_days" integer DEFAULT 30,
	"grace_period_days" integer DEFAULT 7,
	"blocks_assignments" boolean DEFAULT true,
	"is_mandatory" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crew_member_id" varchar NOT NULL,
	"type" text NOT NULL,
	"document_number" text NOT NULL,
	"issue_date" timestamp NOT NULL,
	"expiry_date" timestamp NOT NULL,
	"issuing_authority" text NOT NULL,
	"status" text DEFAULT 'valid' NOT NULL,
	"file_path" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reminder_days" jsonb DEFAULT '[30,15,7]'::jsonb,
	"enabled" boolean DEFAULT true,
	"recipients" jsonb DEFAULT '["office_staff","admin"]'::jsonb,
	"recipient_email" text DEFAULT 'admin@offing.biz',
	"email_template" text,
	"last_monthly_email_month" text,
	"last_monthly_email_morning_sent" timestamp,
	"last_monthly_email_evening_sent" timestamp,
	"last_weekly_summary_month" text,
	"last_weekly_summary_sent" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_date" timestamp NOT NULL,
	"notification_date" timestamp NOT NULL,
	"days_before_event" integer NOT NULL,
	"provider" text NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar,
	"crew_member_id" varchar,
	"notification_type" varchar(50) NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"recipient_email" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'sent',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scanned_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"seafarer_name" text,
	"extracted_number" text,
	"extracted_expiry" timestamp,
	"extracted_issue_date" timestamp,
	"extracted_holder_name" text,
	"mrz_validation" jsonb,
	"ocr_confidence" integer,
	"raw_text" text,
	"superseded_at" timestamp,
	"superseded_by" varchar,
	"owner_validation_status" text,
	"owner_validation_score" integer,
	"owner_validation_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "status_change_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crew_member_id" varchar NOT NULL,
	"previous_status" text NOT NULL,
	"new_status" text NOT NULL,
	"reason" text NOT NULL,
	"changed_by" varchar,
	"changed_by_username" text NOT NULL,
	"vessel_id" varchar,
	"contract_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vessel_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"expiry_date" timestamp,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"imo_number" text,
	"flag" text NOT NULL,
	"status" text DEFAULT 'harbour-mining' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "vessels_imo_number_unique" UNIQUE("imo_number")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"remote_jid" text NOT NULL,
	"from_me" boolean DEFAULT false NOT NULL,
	"body" text NOT NULL,
	"sender_name" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'sent',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT false,
	"provider" text DEFAULT 'twilio' NOT NULL,
	"api_key" text,
	"group_id" text,
	"webhook_url" text,
	"notification_types" jsonb DEFAULT '["contract_expiry","document_expiry","crew_rotation"]'::jsonb,
	"reminder_days" jsonb DEFAULT '[7,3,1]'::jsonb,
	"message_template" text DEFAULT '📋 *Crew Management Alert*

{{title}}
{{description}}

Date: {{date}}
Severity: {{severity}}',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_crew_member_id_crew_members_id_fk" FOREIGN KEY ("crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_current_vessel_id_vessels_id_fk" FOREIGN KEY ("current_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_last_vessel_id_vessels_id_fk" FOREIGN KEY ("last_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_rotations" ADD CONSTRAINT "crew_rotations_crew_member_id_crew_members_id_fk" FOREIGN KEY ("crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_rotations" ADD CONSTRAINT "crew_rotations_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_tokens" ADD CONSTRAINT "document_access_tokens_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_crew_member_id_crew_members_id_fk" FOREIGN KEY ("crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_crew_member_id_crew_members_id_fk" FOREIGN KEY ("crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanned_documents" ADD CONSTRAINT "scanned_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_change_history" ADD CONSTRAINT "status_change_history_crew_member_id_crew_members_id_fk" FOREIGN KEY ("crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_change_history" ADD CONSTRAINT "status_change_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_change_history" ADD CONSTRAINT "status_change_history_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_change_history" ADD CONSTRAINT "status_change_history_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_documents" ADD CONSTRAINT "vessel_documents_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_documents" ADD CONSTRAINT "vessel_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;