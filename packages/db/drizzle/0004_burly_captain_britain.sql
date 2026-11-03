CREATE TABLE "exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"transaction_id" uuid,
	"status" varchar(50) DEFAULT 'OPEN' NOT NULL,
	"assignee_id" uuid,
	"resolution_reason" text,
	"resolution_action" varchar(100),
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exception_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"exception_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exception_comments" ADD CONSTRAINT "exception_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exception_comments" ADD CONSTRAINT "exception_comments_exception_id_exceptions_id_fk" FOREIGN KEY ("exception_id") REFERENCES "public"."exceptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exception_comments" ADD CONSTRAINT "exception_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exceptions_org_status_idx" ON "exceptions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "exceptions_org_run_idx" ON "exceptions" USING btree ("organization_id","run_id");--> statement-breakpoint
CREATE INDEX "exceptions_org_assignee_idx" ON "exceptions" USING btree ("organization_id","assignee_id");--> statement-breakpoint
CREATE INDEX "exceptions_org_created_idx" ON "exceptions" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "exceptions_run_txn_idx" ON "exceptions" USING btree ("run_id","transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exceptions_run_txn_open_idx" ON "exceptions" USING btree ("run_id","transaction_id") WHERE "exceptions"."transaction_id" IS NOT NULL AND "exceptions"."status" != 'RESOLVED';--> statement-breakpoint
CREATE INDEX "exception_comments_exception_created_idx" ON "exception_comments" USING btree ("exception_id","created_at");--> statement-breakpoint
CREATE INDEX "exception_comments_org_created_idx" ON "exception_comments" USING btree ("organization_id","created_at");