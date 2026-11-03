CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_type" varchar(50) DEFAULT 'USER' NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"metadata" jsonb,
	"ip_address" varchar(100),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'QUEUED' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"message" text,
	"reference_type" varchar(50),
	"reference_id" varchar(255),
	"result" jsonb,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_org_created_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_org_action_idx" ON "audit_logs" USING btree ("organization_id","action");--> statement-breakpoint
CREATE INDEX "audit_logs_org_entity_idx" ON "audit_logs" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_org_actor_idx" ON "audit_logs" USING btree ("organization_id","actor_id");--> statement-breakpoint
CREATE INDEX "jobs_org_created_idx" ON "jobs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_org_status_idx" ON "jobs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "jobs_org_type_idx" ON "jobs" USING btree ("organization_id","job_type");--> statement-breakpoint
CREATE INDEX "jobs_org_ref_idx" ON "jobs" USING btree ("organization_id","reference_type","reference_id");