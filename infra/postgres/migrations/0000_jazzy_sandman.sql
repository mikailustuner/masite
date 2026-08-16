CREATE TYPE "public"."audit_mode" AS ENUM('quick', 'standard', 'deep');--> statement-breakpoint
CREATE TYPE "public"."evidence_confidence" AS ENUM('proven', 'strong_inference', 'hypothesis');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('header', 'html', 'dom', 'screenshot', 'har', 'metric', 'serp', 'robots', 'sitemap');--> statement-breakpoint
CREATE TYPE "public"."issue_severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."issue_state" AS ENUM('new', 'confirmed', 'shared', 'in_progress', 'resolved', 'regressed', 'accepted_risk', 'false_positive');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'consultant', 'analyst', 'client_viewer');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"request_id" text,
	"ip_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"mode" "audit_mode" NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"analyzer_version" text NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"discovered_urls" integer DEFAULT 0 NOT NULL,
	"rendered_urls" integer DEFAULT 0 NOT NULL,
	"issues_created" integer DEFAULT 0 NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"origin" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"snapshot_id" uuid,
	"kind" "evidence_kind" NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"source_url" text,
	"artifact_key" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"severity" "issue_severity" NOT NULL,
	"confidence" "evidence_confidence" NOT NULL,
	"state" "issue_state" DEFAULT 'new' NOT NULL,
	"summary" text NOT NULL,
	"impact" text NOT NULL,
	"recommendation" text NOT NULL,
	"verification" text NOT NULL,
	"affected_url_count" integer DEFAULT 1 NOT NULL,
	"effort" text DEFAULT 'S' NOT NULL,
	"assignee_user_id" uuid,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"term" text NOT NULL,
	"locale" text NOT NULL,
	"device" text NOT NULL,
	"location" text NOT NULL,
	"intent" text,
	"cluster_key" text,
	"target_url" text,
	"search_volume" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'internal' NOT NULL,
	"retention_days" integer DEFAULT 365 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"audit_run_id" uuid NOT NULL,
	"status_code" integer NOT NULL,
	"response_time_ms" integer NOT NULL,
	"content_type" text,
	"content_bytes" bigint NOT NULL,
	"artifact_key" text,
	"artifact_sha256" text,
	"extracted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"normalized_url" text NOT NULL,
	"path" text NOT NULL,
	"template_key" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rank_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"keyword_id" uuid NOT NULL,
	"position" real,
	"result_url" text,
	"serp_features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid,
	"created_by_user_id" uuid,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"artifact_key" text,
	"share_token_hash" text,
	"share_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"active_organization_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"origin" text NOT NULL,
	"normalized_host" text NOT NULL,
	"market" text NOT NULL,
	"language" text NOT NULL,
	"status" "site_status" DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_audit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"disabled_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_snapshot_id_page_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."page_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_audit_run_id_audit_runs_id_fk" FOREIGN KEY ("audit_run_id") REFERENCES "public"."audit_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_observations" ADD CONSTRAINT "rank_observations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_observations" ADD CONSTRAINT "rank_observations_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_organization_id_organizations_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_org_time_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_runs_org_site_idx" ON "audit_runs" USING btree ("organization_id","site_id");--> statement-breakpoint
CREATE INDEX "audit_runs_status_idx" ON "audit_runs" USING btree ("status","queued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "competitors_site_origin_uq" ON "competitors" USING btree ("site_id","origin");--> statement-breakpoint
CREATE INDEX "competitors_org_idx" ON "competitors" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "evidence_issue_idx" ON "evidence" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "evidence_org_idx" ON "evidence" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issues_site_fingerprint_uq" ON "issues" USING btree ("site_id","fingerprint");--> statement-breakpoint
CREATE INDEX "issues_org_state_idx" ON "issues" USING btree ("organization_id","state");--> statement-breakpoint
CREATE INDEX "issues_site_severity_idx" ON "issues" USING btree ("site_id","severity");--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_tracking_uq" ON "keywords" USING btree ("site_id","term","locale","device","location");--> statement-breakpoint
CREATE INDEX "keywords_org_idx" ON "keywords" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uq" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "snapshots_run_idx" ON "page_snapshots" USING btree ("audit_run_id");--> statement-breakpoint
CREATE INDEX "snapshots_page_time_idx" ON "page_snapshots" USING btree ("page_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_url_uq" ON "pages" USING btree ("site_id","normalized_url");--> statement-breakpoint
CREATE INDEX "pages_org_idx" ON "pages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rank_keyword_time_idx" ON "rank_observations" USING btree ("keyword_id","captured_at");--> statement-breakpoint
CREATE INDEX "rank_org_idx" ON "rank_observations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "reports_org_idx" ON "reports" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_org_origin_uq" ON "sites" USING btree ("organization_id","origin");--> statement-breakpoint
CREATE INDEX "sites_org_idx" ON "sites" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE FUNCTION current_evidera_organization_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')::uuid
$$;--> statement-breakpoint
ALTER TABLE "sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sites" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sites_tenant_isolation" ON "sites" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());--> statement-breakpoint
ALTER TABLE "competitors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competitors" FORCE ROW LEVEL SECURITY;
CREATE POLICY "competitors_tenant_isolation" ON "competitors" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());--> statement-breakpoint
ALTER TABLE "audit_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_runs_tenant_isolation" ON "audit_runs" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());--> statement-breakpoint
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pages" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pages_tenant_isolation" ON "pages" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());--> statement-breakpoint
ALTER TABLE "page_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "page_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY "page_snapshots_tenant_isolation" ON "page_snapshots" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());--> statement-breakpoint
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issues" FORCE ROW LEVEL SECURITY;
CREATE POLICY "issues_tenant_isolation" ON "issues" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());--> statement-breakpoint
ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence" FORCE ROW LEVEL SECURITY;
CREATE POLICY "evidence_tenant_isolation" ON "evidence" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());--> statement-breakpoint
ALTER TABLE "keywords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "keywords" FORCE ROW LEVEL SECURITY;
CREATE POLICY "keywords_tenant_isolation" ON "keywords" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());--> statement-breakpoint
ALTER TABLE "rank_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rank_observations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "rank_observations_tenant_isolation" ON "rank_observations" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY "reports_tenant_isolation" ON "reports" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs" USING ("organization_id" = current_evidera_organization_id()) WITH CHECK ("organization_id" = current_evidera_organization_id());
