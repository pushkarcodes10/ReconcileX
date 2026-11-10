CREATE TABLE "screenshot_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"data_source_id" uuid,
	"name" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'PROCESSING' NOT NULL,
	"total_files" integer DEFAULT 0 NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"confirmed_records" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"confirmed_by_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenshot_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"dataset_id" uuid NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"content_sha256" varchar(64) NOT NULL,
	"status" varchar(50) DEFAULT 'UPLOADED' NOT NULL,
	"raw_ocr_text" text,
	"extracted_count" integer DEFAULT 0 NOT NULL,
	"extraction_metadata" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenshot_extracted_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"dataset_id" uuid NOT NULL,
	"screenshot_file_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"amount" double precision NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"reference" varchar(255),
	"external_txn_id" varchar(255),
	"merchant_or_order_id" varchar(255),
	"txn_type" varchar(50) DEFAULT 'PAYMENT',
	"payment_method" varchar(50),
	"sender_receiver" varchar(255),
	"description" text,
	"confidence_score" integer DEFAULT 80 NOT NULL,
	"field_confidences" jsonb,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"is_low_confidence" boolean DEFAULT false NOT NULL,
	"validation_errors" jsonb,
	"user_corrected" boolean DEFAULT false NOT NULL,
	"user_correction_history" jsonb,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "screenshot_file_id" uuid;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD COLUMN "source_d_id" uuid;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD COLUMN "total_source_d" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "transaction_d_id" uuid;--> statement-breakpoint
ALTER TABLE "screenshot_datasets" ADD CONSTRAINT "screenshot_datasets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_datasets" ADD CONSTRAINT "screenshot_datasets_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_datasets" ADD CONSTRAINT "screenshot_datasets_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_files" ADD CONSTRAINT "screenshot_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_files" ADD CONSTRAINT "screenshot_files_dataset_id_screenshot_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."screenshot_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_extracted_records" ADD CONSTRAINT "screenshot_extracted_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_extracted_records" ADD CONSTRAINT "screenshot_extracted_records_dataset_id_screenshot_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."screenshot_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_extracted_records" ADD CONSTRAINT "screenshot_extracted_records_screenshot_file_id_screenshot_files_id_fk" FOREIGN KEY ("screenshot_file_id") REFERENCES "public"."screenshot_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_extracted_records" ADD CONSTRAINT "screenshot_extracted_records_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "screenshot_datasets_org_idx" ON "screenshot_datasets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "screenshot_datasets_org_status_idx" ON "screenshot_datasets" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "screenshot_datasets_datasource_idx" ON "screenshot_datasets" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "screenshot_files_org_idx" ON "screenshot_files" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "screenshot_files_dataset_idx" ON "screenshot_files" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "screenshot_files_sha256_idx" ON "screenshot_files" USING btree ("organization_id","content_sha256");--> statement-breakpoint
CREATE INDEX "screenshot_extracted_records_org_idx" ON "screenshot_extracted_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "screenshot_extracted_records_dataset_idx" ON "screenshot_extracted_records" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "screenshot_extracted_records_file_idx" ON "screenshot_extracted_records" USING btree ("screenshot_file_id");--> statement-breakpoint
CREATE INDEX "screenshot_extracted_records_txn_idx" ON "screenshot_extracted_records" USING btree ("transaction_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_screenshot_file_id_screenshot_files_id_fk" FOREIGN KEY ("screenshot_file_id") REFERENCES "public"."screenshot_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_source_d_id_data_sources_id_fk" FOREIGN KEY ("source_d_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_transaction_d_id_transactions_id_fk" FOREIGN KEY ("transaction_d_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_org_screenshot_file_idx" ON "transactions" USING btree ("organization_id","screenshot_file_id");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_org_source_d_idx" ON "reconciliation_runs" USING btree ("organization_id","source_d_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_run_txn_d_active_idx" ON "matches" USING btree ("run_id","transaction_d_id") WHERE status != 'REJECTED' AND transaction_d_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "matches_org_txn_d_idx" ON "matches" USING btree ("organization_id","transaction_d_id");