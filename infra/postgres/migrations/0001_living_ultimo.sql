CREATE TABLE "audit_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"mode" "audit_mode" DEFAULT 'standard' NOT NULL,
	"interval_hours" integer DEFAULT 168 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_schedules" ADD CONSTRAINT "audit_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_schedules" ADD CONSTRAINT "audit_schedules_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_schedules_site_uq" ON "audit_schedules" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "audit_schedules_due_idx" ON "audit_schedules" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "audit_schedules_org_idx" ON "audit_schedules" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "audit_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_schedules_tenant_isolation" ON "audit_schedules"
USING ("organization_id" = current_evidera_organization_id() OR current_setting('app.evidera_scheduler', true) = 'true')
WITH CHECK ("organization_id" = current_evidera_organization_id() OR current_setting('app.evidera_scheduler', true) = 'true');
