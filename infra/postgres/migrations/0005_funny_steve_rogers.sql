CREATE TYPE "public"."journey_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "intelligence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"audit_run_id" uuid,
	"module" text NOT NULL,
	"fingerprint" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"confidence" "evidence_confidence" NOT NULL,
	"title" text NOT NULL,
	"observation" text NOT NULL,
	"evidence_summary" text NOT NULL,
	"inference" text NOT NULL,
	"impact" text NOT NULL,
	"recommendation" text NOT NULL,
	"verification" text NOT NULL,
	"source" text NOT NULL,
	"methodology" text NOT NULL,
	"measurement" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_url" text NOT NULL,
	"device" text DEFAULT 'mobile' NOT NULL,
	"locale" text DEFAULT 'tr-TR' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety" jsonb DEFAULT '{"allowSubmit":false,"maxSteps":12}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"journey_id" uuid NOT NULL,
	"status" "journey_run_status" DEFAULT 'queued' NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"analyzer_version" text DEFAULT 'journey/0.1.0' NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "site_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"audit_run_id" uuid,
	"page_id" uuid,
	"kind" text NOT NULL,
	"severity" "issue_severity" DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"observation" text NOT NULL,
	"inference" text NOT NULL,
	"impact" text NOT NULL,
	"source_url" text,
	"before_value" jsonb,
	"after_value" jsonb,
	"evidence_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD CONSTRAINT "intelligence_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD CONSTRAINT "intelligence_items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD CONSTRAINT "intelligence_items_audit_run_id_audit_runs_id_fk" FOREIGN KEY ("audit_run_id") REFERENCES "public"."audit_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_definitions" ADD CONSTRAINT "journey_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_definitions" ADD CONSTRAINT "journey_definitions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_runs" ADD CONSTRAINT "journey_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_runs" ADD CONSTRAINT "journey_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_runs" ADD CONSTRAINT "journey_runs_journey_id_journey_definitions_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journey_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_audit_run_id_audit_runs_id_fk" FOREIGN KEY ("audit_run_id") REFERENCES "public"."audit_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "intelligence_site_fingerprint_uq" ON "intelligence_items" USING btree ("site_id","fingerprint");--> statement-breakpoint
CREATE INDEX "intelligence_org_site_module_idx" ON "intelligence_items" USING btree ("organization_id","site_id","module");--> statement-breakpoint
CREATE INDEX "intelligence_priority_idx" ON "intelligence_items" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "journeys_org_site_idx" ON "journey_definitions" USING btree ("organization_id","site_id");--> statement-breakpoint
CREATE INDEX "journey_runs_org_site_idx" ON "journey_runs" USING btree ("organization_id","site_id");--> statement-breakpoint
CREATE INDEX "journey_runs_journey_time_idx" ON "journey_runs" USING btree ("journey_id","queued_at");--> statement-breakpoint
CREATE INDEX "site_events_org_site_time_idx" ON "site_events" USING btree ("organization_id","site_id","captured_at");--> statement-breakpoint
CREATE INDEX "site_events_run_idx" ON "site_events" USING btree ("audit_run_id");
--> statement-breakpoint
ALTER TABLE "site_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intelligence_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journey_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journey_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "site_events_tenant_policy" ON "site_events" USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
CREATE POLICY "intelligence_items_tenant_policy" ON "intelligence_items" USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
CREATE POLICY "journey_definitions_tenant_policy" ON "journey_definitions" USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
CREATE POLICY "journey_runs_tenant_policy" ON "journey_runs" USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
