CREATE TABLE "ad_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"objective" text NOT NULL,
	"audience" text NOT NULL,
	"offer" text NOT NULL,
	"content" jsonb NOT NULL,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_briefs" ADD CONSTRAINT "ad_briefs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_briefs" ADD CONSTRAINT "ad_briefs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_briefs" ADD CONSTRAINT "ad_briefs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_briefs_org_site_idx" ON "ad_briefs" USING btree ("organization_id","site_id");--> statement-breakpoint
CREATE INDEX "ad_briefs_created_idx" ON "ad_briefs" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "ad_briefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_briefs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ad_briefs_tenant_isolation" ON "ad_briefs" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());
