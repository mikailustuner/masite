import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const membershipRole = pgEnum("membership_role", ["owner", "consultant", "analyst", "client_viewer"]);
export const siteStatus = pgEnum("site_status", ["active", "paused", "archived"]);
export const auditMode = pgEnum("audit_mode", ["quick", "standard", "deep"]);
export const runStatus = pgEnum("run_status", ["queued", "running", "completed", "failed", "cancelled"]);
export const issueSeverity = pgEnum("issue_severity", ["critical", "high", "medium", "low", "info"]);
export const evidenceConfidence = pgEnum("evidence_confidence", ["proven", "strong_inference", "hypothesis"]);
export const issueState = pgEnum("issue_state", ["new", "confirmed", "shared", "in_progress", "resolved", "regressed", "accepted_risk", "false_positive"]);
export const evidenceKind = pgEnum("evidence_kind", ["header", "html", "dom", "screenshot", "har", "metric", "serp", "robots", "sitemap"]);
export const journeyRunStatus = pgEnum("journey_run_status", ["queued", "running", "completed", "failed", "cancelled"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  plan: text("plan").notNull().default("internal"),
  retentionDays: integer("retention_days").notNull().default(365),
  ...timestamps,
}, (table) => [uniqueIndex("organizations_slug_uq").on(table.slug)]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_uq").on(table.email)]);

export const memberships = pgTable("memberships", {
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: membershipRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.organizationId, table.userId] }), index("memberships_user_idx").on(table.userId)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activeOrganizationId: uuid("active_organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("sessions_token_hash_uq").on(table.tokenHash), index("sessions_user_idx").on(table.userId), index("sessions_expiry_idx").on(table.expiresAt)]);

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  normalizedHost: text("normalized_host").notNull(),
  market: text("market").notNull(),
  language: text("language").notNull(),
  status: siteStatus("status").notNull().default("active"),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  lastAuditAt: timestamp("last_audit_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("sites_org_origin_uq").on(table.organizationId, table.origin), index("sites_org_idx").on(table.organizationId)]);

export const competitors = pgTable("competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("competitors_site_origin_uq").on(table.siteId, table.origin), index("competitors_org_idx").on(table.organizationId)]);

export const auditRuns = pgTable("audit_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
  mode: auditMode("mode").notNull(),
  status: runStatus("status").notNull().default("queued"),
  analyzerVersion: text("analyzer_version").notNull(),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  discoveredUrls: integer("discovered_urls").notNull().default(0),
  renderedUrls: integer("rendered_urls").notNull().default(0),
  issuesCreated: integer("issues_created").notNull().default(0),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [index("audit_runs_org_site_idx").on(table.organizationId, table.siteId), index("audit_runs_status_idx").on(table.status, table.queuedAt)]);

export const auditSchedules = pgTable("audit_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  mode: auditMode("mode").notNull().default("standard"),
  intervalHours: integer("interval_hours").notNull().default(168),
  enabled: boolean("enabled").notNull().default(true),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("audit_schedules_site_uq").on(table.siteId), index("audit_schedules_due_idx").on(table.enabled, table.nextRunAt), index("audit_schedules_org_idx").on(table.organizationId)]);

export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  normalizedUrl: text("normalized_url").notNull(),
  path: text("path").notNull(),
  templateKey: text("template_key"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("pages_site_url_uq").on(table.siteId, table.normalizedUrl), index("pages_org_idx").on(table.organizationId)]);

export const pageSnapshots = pgTable("page_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  auditRunId: uuid("audit_run_id").notNull().references(() => auditRuns.id, { onDelete: "cascade" }),
  statusCode: integer("status_code").notNull(),
  responseTimeMs: integer("response_time_ms").notNull(),
  contentType: text("content_type"),
  contentBytes: bigint("content_bytes", { mode: "number" }).notNull(),
  artifactKey: text("artifact_key"),
  artifactSha256: text("artifact_sha256"),
  extracted: jsonb("extracted").$type<Record<string, unknown>>().notNull().default({}),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("snapshots_run_idx").on(table.auditRunId), index("snapshots_page_time_idx").on(table.pageId, table.capturedAt)]);

export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  severity: issueSeverity("severity").notNull(),
  confidence: evidenceConfidence("confidence").notNull(),
  state: issueState("state").notNull().default("new"),
  summary: text("summary").notNull(),
  inference: text("inference").notNull().default("Nedensellik veya gerçek iş etkisi harici gözlemle doğrulanamaz."),
  impact: text("impact").notNull(),
  recommendation: text("recommendation").notNull(),
  verification: text("verification").notNull(),
  affectedUrlCount: integer("affected_url_count").notNull().default(1),
  effort: text("effort").notNull().default("S"),
  assigneeUserId: uuid("assignee_user_id").references(() => users.id, { onDelete: "set null" }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("issues_site_fingerprint_uq").on(table.siteId, table.fingerprint), index("issues_org_state_idx").on(table.organizationId, table.state), index("issues_site_severity_idx").on(table.siteId, table.severity)]);

export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  snapshotId: uuid("snapshot_id").references(() => pageSnapshots.id, { onDelete: "set null" }),
  kind: evidenceKind("kind").notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  sourceUrl: text("source_url"),
  artifactKey: text("artifact_key"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("evidence_issue_idx").on(table.issueId), index("evidence_org_idx").on(table.organizationId)]);

export const siteEvents = pgTable("site_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  auditRunId: uuid("audit_run_id").references(() => auditRuns.id, { onDelete: "set null" }),
  pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  severity: issueSeverity("severity").notNull().default("info"),
  title: text("title").notNull(),
  observation: text("observation").notNull(),
  inference: text("inference").notNull(),
  impact: text("impact").notNull(),
  sourceUrl: text("source_url"),
  beforeValue: jsonb("before_value").$type<unknown>(),
  afterValue: jsonb("after_value").$type<unknown>(),
  evidenceData: jsonb("evidence_data").$type<Record<string, unknown>>().notNull().default({}),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("site_events_org_site_time_idx").on(table.organizationId, table.siteId, table.capturedAt), index("site_events_run_idx").on(table.auditRunId)]);

export const intelligenceItems = pgTable("intelligence_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  auditRunId: uuid("audit_run_id").references(() => auditRuns.id, { onDelete: "set null" }),
  module: text("module").notNull(),
  fingerprint: text("fingerprint").notNull(),
  status: text("status").notNull().default("active"),
  priority: integer("priority").notNull().default(50),
  confidence: evidenceConfidence("confidence").notNull(),
  title: text("title").notNull(),
  observation: text("observation").notNull(),
  evidenceSummary: text("evidence_summary").notNull(),
  inference: text("inference").notNull(),
  impact: text("impact").notNull(),
  recommendation: text("recommendation").notNull(),
  verification: text("verification").notNull(),
  source: text("source").notNull(),
  methodology: text("methodology").notNull(),
  measurement: jsonb("measurement").$type<Record<string, unknown>>().notNull().default({}),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (table) => [uniqueIndex("intelligence_site_fingerprint_uq").on(table.siteId, table.fingerprint), index("intelligence_org_site_module_idx").on(table.organizationId, table.siteId, table.module), index("intelligence_priority_idx").on(table.priority)]);

export const journeyDefinitions = pgTable("journey_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startUrl: text("start_url").notNull(),
  device: text("device").notNull().default("mobile"),
  locale: text("locale").notNull().default("tr-TR"),
  enabled: boolean("enabled").notNull().default(true),
  steps: jsonb("steps").$type<Array<{ action: "click" | "fill" | "assert_visible" | "assert_url"; selector?: string; value?: string; description: string }>>().notNull().default([]),
  safety: jsonb("safety").$type<{ allowSubmit: false; maxSteps: number }>().notNull().default({ allowSubmit: false, maxSteps: 12 }),
  ...timestamps,
}, (table) => [index("journeys_org_site_idx").on(table.organizationId, table.siteId)]);

export const journeyRuns = pgTable("journey_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  journeyId: uuid("journey_id").notNull().references(() => journeyDefinitions.id, { onDelete: "cascade" }),
  status: journeyRunStatus("status").notNull().default("queued"),
  result: jsonb("result").$type<Record<string, unknown>>().notNull().default({}),
  errorMessage: text("error_message"),
  analyzerVersion: text("analyzer_version").notNull().default("journey/0.1.0"),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [index("journey_runs_org_site_idx").on(table.organizationId, table.siteId), index("journey_runs_journey_time_idx").on(table.journeyId, table.queuedAt)]);

export const keywords = pgTable("keywords", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  term: text("term").notNull(),
  locale: text("locale").notNull(),
  device: text("device").notNull(),
  location: text("location").notNull(),
  intent: text("intent"),
  clusterKey: text("cluster_key"),
  targetUrl: text("target_url"),
  searchVolume: integer("search_volume"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
}, (table) => [uniqueIndex("keywords_tracking_uq").on(table.siteId, table.term, table.locale, table.device, table.location), index("keywords_org_idx").on(table.organizationId)]);

export const rankObservations = pgTable("rank_observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  keywordId: uuid("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  position: real("position"),
  resultUrl: text("result_url"),
  serpFeatures: jsonb("serp_features").$type<string[]>().notNull().default([]),
  provider: text("provider").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("rank_keyword_time_idx").on(table.keywordId, table.capturedAt), index("rank_org_idx").on(table.organizationId)]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("draft"),
  artifactKey: text("artifact_key"),
  shareTokenHash: text("share_token_hash"),
  shareExpiresAt: timestamp("share_expires_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("reports_org_idx").on(table.organizationId, table.createdAt)]);

export const reportShares = pgTable("report_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("report_shares_token_uq").on(table.tokenHash), index("report_shares_report_idx").on(table.reportId), index("report_shares_expiry_idx").on(table.expiresAt)]);

export const adBriefs = pgTable("ad_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  platform: text("platform").notNull(),
  name: text("name").notNull(),
  objective: text("objective").notNull(),
  audience: text("audience").notNull(),
  offer: text("offer").notNull(),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  evidenceRefs: jsonb("evidence_refs").$type<Array<Record<string, unknown>>>().notNull().default([]),
  status: text("status").notNull().default("draft"),
  ...timestamps,
}, (table) => [index("ad_briefs_org_site_idx").on(table.organizationId, table.siteId), index("ad_briefs_created_idx").on(table.createdAt)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  requestId: text("request_id"),
  ipHash: text("ip_hash"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("audit_logs_org_time_idx").on(table.organizationId, table.createdAt)]);
