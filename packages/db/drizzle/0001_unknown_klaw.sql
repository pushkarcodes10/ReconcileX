CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"direction" varchar(50) DEFAULT 'INCOMING' NOT NULL,
	"column_mapping" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duplicate_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"data_source_id" uuid NOT NULL,
	"existing_transaction_id" uuid,
	"candidate_transaction_id" uuid,
	"external_id" varchar(255) NOT NULL,
	"reason" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'FLAGGED' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"data_source_id" uuid NOT NULL,
	"import_id" uuid,
	"external_id" varchar(255) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"reference" varchar(255),
	"external_txn_id" varchar(255),
	"merchant_or_order_id" varchar(255),
	"txn_type" varchar(50),
	"status" varchar(50) DEFAULT 'IMPORTED' NOT NULL,
	"normalized_payload" jsonb,
	"fingerprint" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_existing_transaction_id_transactions_id_fk" FOREIGN KEY ("existing_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_candidate_transaction_id_transactions_id_fk" FOREIGN KEY ("candidate_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "data_sources_org_name_idx" ON "data_sources" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "data_sources_org_status_idx" ON "data_sources" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "duplicate_candidates_org_status_idx" ON "duplicate_candidates" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "duplicate_candidates_org_source_idx" ON "duplicate_candidates" USING btree ("organization_id","data_source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_org_source_ext_id_idx" ON "transactions" USING btree ("organization_id","data_source_id","external_id");--> statement-breakpoint
CREATE INDEX "transactions_org_date_idx" ON "transactions" USING btree ("organization_id","transaction_date");--> statement-breakpoint
CREATE INDEX "transactions_org_status_idx" ON "transactions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "transactions_org_reference_idx" ON "transactions" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "transactions_org_source_idx" ON "transactions" USING btree ("organization_id","data_source_id");