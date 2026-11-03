CREATE TABLE "duplicate_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"data_source_id" uuid NOT NULL,
	"existing_transaction_id" uuid,
	"candidate_fingerprint" varchar(64),
	"external_id" varchar(255) NOT NULL,
	"row_number" integer,
	"reason" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'FLAGGED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_row_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"field" varchar(100),
	"code" varchar(100) NOT NULL,
	"raw_value" text,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"data_source_id" uuid NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"content_sha256" varchar(64) NOT NULL,
	"status" varchar(50) DEFAULT 'QUEUED' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"valid_count" integer DEFAULT 0 NOT NULL,
	"invalid_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"error_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_existing_transaction_id_transactions_id_fk" FOREIGN KEY ("existing_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row_errors" ADD CONSTRAINT "import_row_errors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row_errors" ADD CONSTRAINT "import_row_errors_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_org_datasource_fk" FOREIGN KEY ("organization_id","data_source_id") REFERENCES "public"."data_sources"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "duplicate_candidates_org_import_idx" ON "duplicate_candidates" USING btree ("organization_id","import_id");--> statement-breakpoint
CREATE INDEX "duplicate_candidates_org_status_idx" ON "duplicate_candidates" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "duplicate_candidates_org_source_idx" ON "duplicate_candidates" USING btree ("organization_id","data_source_id");--> statement-breakpoint
CREATE INDEX "import_row_errors_org_import_idx" ON "import_row_errors" USING btree ("organization_id","import_id");--> statement-breakpoint
CREATE INDEX "import_row_errors_import_row_idx" ON "import_row_errors" USING btree ("import_id","row_number");--> statement-breakpoint
CREATE UNIQUE INDEX "imports_org_source_sha256_idx" ON "imports" USING btree ("organization_id","data_source_id","content_sha256");--> statement-breakpoint
CREATE INDEX "imports_org_source_idx" ON "imports" USING btree ("organization_id","data_source_id");--> statement-breakpoint
CREATE INDEX "imports_org_status_idx" ON "imports" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "imports_org_created_idx" ON "imports" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_org_import_idx" ON "transactions" USING btree ("organization_id","import_id");