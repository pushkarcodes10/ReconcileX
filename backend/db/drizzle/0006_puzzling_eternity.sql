DROP INDEX "matches_run_txna_txnb_idx";--> statement-breakpoint
DROP INDEX "matches_run_txn_a_active_idx";--> statement-breakpoint
DROP INDEX "matches_run_txn_b_active_idx";--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "transaction_a_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "transaction_b_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD COLUMN "reconciliation_type" varchar(50) DEFAULT 'TWO_SOURCE' NOT NULL;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD COLUMN "source_c_id" uuid;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD COLUMN "total_source_c" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD COLUMN "fully_matched_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD COLUMN "partially_matched_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD COLUMN "discrepancy_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "reconciliation_type" varchar(50) DEFAULT 'TWO_SOURCE' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "transaction_c_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "discrepancy_details" jsonb;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "match_id" uuid;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "exception_type" varchar(50) DEFAULT 'UNMATCHED' NOT NULL;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "discrepancy_details" jsonb;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_source_c_id_data_sources_id_fk" FOREIGN KEY ("source_c_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_transaction_c_id_transactions_id_fk" FOREIGN KEY ("transaction_c_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_run_txn_c_active_idx" ON "matches" USING btree ("run_id","transaction_c_id") WHERE status != 'REJECTED' AND transaction_c_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "matches_org_txn_c_idx" ON "matches" USING btree ("organization_id","transaction_c_id");--> statement-breakpoint
CREATE INDEX "exceptions_org_match_idx" ON "exceptions" USING btree ("organization_id","match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_run_txn_a_active_idx" ON "matches" USING btree ("run_id","transaction_a_id") WHERE status != 'REJECTED' AND transaction_a_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_run_txn_b_active_idx" ON "matches" USING btree ("run_id","transaction_b_id") WHERE status != 'REJECTED' AND transaction_b_id IS NOT NULL;