import { z } from "zod";

export type IssueSeverity = "critical" | "high" | "medium" | "low" | "info";
export type EvidenceConfidence = "proven" | "strong-inference" | "hypothesis";
export type IssueStatus =
  | "new"
  | "confirmed"
  | "shared"
  | "in-progress"
  | "resolved"
  | "regressed"
  | "accepted-risk";

export interface SiteSummary {
  id: string;
  name: string;
  domain: string;
  market: string;
  language: string;
  origin: string;
  healthScore: number;
  visibilityScore: number | null;
  accessibilityScore: number | null;
  performanceScore: number | null;
  openIssues: number;
  criticalIssues: number;
  trend: number | null;
  lastScanAt: string | null;
  status: "healthy" | "attention" | "critical" | "scanning";
}

export interface EvidenceItem {
  id: string;
  kind: "header" | "html" | "dom" | "screenshot" | "har" | "metric" | "serp";
  label: string;
  value: string;
  capturedAt: string;
  sourceUrl?: string;
  artifactKey?: string | null;
}

export interface AuditIssue {
  id: string;
  siteId: string;
  title: string;
  category: "technical" | "performance" | "accessibility" | "security" | "content" | "privacy";
  severity: IssueSeverity;
  confidence: EvidenceConfidence;
  status: IssueStatus;
  affectedUrls: number;
  affectedTemplates: string[];
  summary: string;
  inference: string;
  impact: string;
  recommendation: string;
  verification: string;
  effort: "XS" | "S" | "M" | "L" | "XL";
  firstSeenAt: string;
  lastSeenAt: string;
  evidence: EvidenceItem[];
}

export interface ApiIssue {
  id: string;
  siteId: string;
  title: string;
  category: string;
  severity: IssueSeverity;
  confidence: "proven" | "strong_inference" | "hypothesis";
  state: "new" | "confirmed" | "shared" | "in_progress" | "resolved" | "regressed" | "accepted_risk" | "false_positive";
  affectedUrlCount: number;
  summary: string;
  inference: string;
  impact: string;
  recommendation: string;
  verification: string;
  effort: string;
  firstSeenAt: string;
  lastSeenAt: string;
  evidence?: EvidenceItem[];
}

export interface ApiAuditRun {
  id: string;
  siteId: string;
  mode: "quick" | "standard" | "deep";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  queuedAt: string;
  completedAt: string | null;
  discoveredUrls: number;
  renderedUrls: number;
  issuesCreated: number;
  errorMessage: string | null;
}

export interface AuditRequest {
  url: string;
  mode: "quick" | "standard" | "deep";
  device: "mobile" | "desktop" | "both";
}

export interface AuditRun {
  id: string;
  siteId: string;
  status: "queued" | "running" | "completed" | "failed";
  requestedAt: string;
  completedAt?: string;
  discoveredUrls: number;
  renderedUrls: number;
  issuesCreated: number;
}

export const loginRequestSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(12).max(1024),
});

export const userSessionSchema = z.object({
  user: z.object({ id: z.uuid(), email: z.email(), displayName: z.string() }),
  organization: z.object({ id: z.uuid(), name: z.string(), slug: z.string() }),
  role: z.enum(["owner", "consultant", "analyst", "client_viewer"]),
});

export const createSiteRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  origin: z.url().max(2048),
  market: z.string().trim().min(2).max(120),
  language: z.string().trim().regex(/^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?$/),
});

export const createAuditRequestSchema = z.object({
  siteId: z.uuid(),
  mode: z.enum(["quick", "standard", "deep"]),
});

export const upsertAuditScheduleRequestSchema = z.object({
  mode: z.enum(["quick", "standard", "deep"]),
  intervalHours: z.number().int().min(24).max(24 * 90),
  enabled: z.boolean(),
});

export const issueStateSchema = z.enum(["new", "confirmed", "shared", "in_progress", "resolved", "regressed", "accepted_risk", "false_positive"]);

export const updateIssueRequestSchema = z.object({
  state: issueStateSchema.optional(),
  assigneeUserId: z.uuid().nullable().optional(),
}).refine((value) => value.state !== undefined || value.assigneeUserId !== undefined, { message: "At least one field is required." });

export const createKeywordRequestSchema = z.object({
  siteId: z.uuid(),
  term: z.string().trim().min(1).max(300),
  locale: z.string().trim().min(2).max(20).default("tr-TR"),
  device: z.enum(["mobile", "desktop"]).default("mobile"),
  location: z.string().trim().min(2).max(120),
  intent: z.enum(["informational", "commercial", "transactional", "navigational", "local"]).nullable().optional(),
  targetUrl: z.url().max(2048).nullable().optional(),
});

export const createCompetitorRequestSchema = z.object({
  siteId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  origin: z.url().max(2048),
  kind: z.enum(["business", "organic", "content", "serp"]),
});

export const createAdBriefRequestSchema = z.object({
  siteId: z.uuid(),
  platform: z.enum(["google", "meta"]),
  name: z.string().trim().min(2).max(120),
  objective: z.string().trim().min(2).max(300),
  audience: z.string().trim().min(2).max(500),
  offer: z.string().trim().min(2).max(500),
});

export const createReportRequestSchema = z.object({
  siteId: z.uuid(),
  title: z.string().trim().min(2).max(160),
  kind: z.enum(["executive", "technical", "competitor", "ads"]),
});

export const createReportShareRequestSchema = z.object({ expiresInDays: z.number().int().min(1).max(90).default(14) });

export interface TrackedKeyword {
  id: string; siteId: string; term: string; locale: string; device: string; location: string;
  intent: string | null; targetUrl: string | null; searchVolume: number | null; position: number | null;
  previousPosition: number | null; capturedAt: string | null; provider: string | null;
}

export interface CompetitorSummary {
  id: string; siteId: string; name: string; origin: string; kind: string; createdAt: string;
  visibility: number | null; overlap: number | null; top10: number | null;
}

export interface AdBrief {
  id: string; siteId: string; platform: "google" | "meta"; name: string; objective: string; audience: string; offer: string;
  content: Record<string, unknown>; evidenceRefs: Array<Record<string, unknown>>; status: string; createdAt: string;
}

export interface VisibilitySnapshot { date: string; score: number; top3: number; top10: number; tracked: number; measured: number }

export const intelligenceModules = ["change", "content", "serp", "competitor", "structured_data", "performance", "accessibility", "privacy", "trust", "local", "commerce", "saas", "ads", "ai_visibility", "compatibility", "sustainability", "portfolio"] as const;
export type IntelligenceModule = typeof intelligenceModules[number];

export interface SiteEvent {
  id: string; siteId: string; kind: string; severity: IssueSeverity; title: string; observation: string;
  inference: string; impact: string; sourceUrl: string | null; beforeValue: unknown; afterValue: unknown;
  evidenceData: Record<string, unknown>; capturedAt: string;
}

export interface IntelligenceItem {
  id: string; siteId: string; module: IntelligenceModule; status: string; priority: number;
  confidence: "proven" | "strong_inference" | "hypothesis"; title: string; observation: string;
  evidenceSummary: string; inference: string; impact: string; recommendation: string; verification: string;
  source: string; methodology: string; measurement: Record<string, unknown>; firstSeenAt: string; lastSeenAt: string;
}

export const journeyStepSchema = z.object({
  action: z.enum(["click", "fill", "assert_visible", "assert_url"]),
  selector: z.string().trim().max(500).optional(),
  value: z.string().max(1000).optional(),
  description: z.string().trim().min(2).max(300),
});

export const createJourneyRequestSchema = z.object({
  siteId: z.uuid(), name: z.string().trim().min(2).max(120), startUrl: z.url().max(2048),
  device: z.enum(["mobile", "desktop"]).default("mobile"), locale: z.string().trim().min(2).max(20).default("tr-TR"),
  steps: z.array(journeyStepSchema).min(1).max(12),
});

export interface JourneyDefinition {
  id: string; siteId: string; name: string; startUrl: string; device: string; locale: string; enabled: boolean;
  steps: Array<z.infer<typeof journeyStepSchema>>; safety: { allowSubmit: false; maxSteps: number }; createdAt: string; updatedAt: string;
}

export interface JourneyRun {
  id: string; siteId: string; journeyId: string; status: "queued" | "running" | "completed" | "failed" | "cancelled";
  result: Record<string, unknown>; errorMessage: string | null; analyzerVersion: string; queuedAt: string;
  startedAt: string | null; completedAt: string | null;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  requestId?: string;
  errors?: Record<string, string[]>;
}

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type UserSession = z.infer<typeof userSessionSchema>;
export type CreateSiteRequest = z.infer<typeof createSiteRequestSchema>;
export type CreateAuditRequest = z.infer<typeof createAuditRequestSchema>;
export type UpdateIssueRequest = z.infer<typeof updateIssueRequestSchema>;
export type CreateKeywordRequest = z.infer<typeof createKeywordRequestSchema>;
export type CreateCompetitorRequest = z.infer<typeof createCompetitorRequestSchema>;
export type CreateAdBriefRequest = z.infer<typeof createAdBriefRequestSchema>;
