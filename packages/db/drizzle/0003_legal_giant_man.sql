CREATE TABLE "reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"display_id" varchar(50) NOT NULL,
	"source_a_id" uuid NOT NULL,
	"source_b_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"config" jsonb NOT NULL,
	"total_source_a" integer DEFAULT 0 NOT NULL,
	"total_source_b" integer DEFAULT 0 NOT NULL,
	"exact_match_count" integer DEFAULT 0 NOT NULL,
	"potential_match_count" integer DEFAULT 0 NOT NULL,
	"unmatched_count" integer DEFAULT 0 NOT NULL,
	"idempotency_key" varchar(255),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"transaction_a_id" uuid NOT NULL,
	"transaction_b_id" uuid NOT NULL,
	"classification" varchar(50) NOT NULL,
	"score" integer NOT NULL,
	"reasons" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"rejected_by" uuid,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_source_a_id_data_sources_id_fk" FOREIGN KEY ("source_a_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_source_b_id_data_sources_id_fk" FOREIGN KEY ("source_b_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_org_source_a_fk" FOREIGN KEY ("organization_id","source_a_id") REFERENCES "public"."data_sources"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_org_source_b_fk" FOREIGN KEY ("organization_id","source_b_id") REFERENCES "public"."data_sources"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_transaction_a_id_transactions_id_fk" FOREIGN KEY ("transaction_a_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_transaction_b_id_transactions_id_fk" FOREIGN KEY ("transaction_b_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_runs_org_display_id_idx" ON "reconciliation_runs" USING btree ("organization_id","display_id");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_org_status_idx" ON "reconciliation_runs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_org_created_idx" ON "reconciliation_runs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_org_idempotency_idx" ON "reconciliation_runs" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_run_txna_txnb_idx" ON "matches" USING btree ("run_id","transaction_a_id","transaction_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_run_txn_a_active_idx" ON "matches" USING btree ("run_id","transaction_a_id") WHERE status != 'REJECTED';--> statement-breakpoint
CREATE UNIQUE INDEX "matches_run_txn_b_active_idx" ON "matches" USING btree ("run_id","transaction_b_id") WHERE status != 'REJECTED';--> statement-breakpoint
CREATE INDEX "matches_org_run_idx" ON "matches" USING btree ("organization_id","run_id");--> statement-breakpoint
CREATE INDEX "matches_org_status_idx" ON "matches" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "matches_org_classification_idx" ON "matches" USING btree ("organization_id","classification");