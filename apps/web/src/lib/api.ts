import type { AdBrief, ApiAuditRun, ApiIssue, CompetitorSummary, CreateAdBriefRequest, CreateCompetitorRequest, CreateKeywordRequest, CreateSiteRequest, IntelligenceItem, JourneyDefinition, JourneyRun, ProblemDetails, SiteEvent, SiteSummary, TrackedKeyword, UserSession, VisibilitySnapshot } from "@evidera/contracts";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null) as T | ProblemDetails | null;
  if (!response.ok) {
    const problem = payload as ProblemDetails | null;
    throw new ApiError(problem?.detail ?? "İstek tamamlanamadı.", response.status, problem?.code ?? "REQUEST_FAILED");
  }
  return payload as T;
}

export const api = {
  session: () => request<UserSession>("/api/auth/session"),
  login: (email: string, password: string) => request<UserSession>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST", body: "{}" }),
  sites: () => request<SiteSummary[]>("/api/sites"),
  createSite: (input: CreateSiteRequest) => request<SiteSummary>("/api/sites", { method: "POST", body: JSON.stringify(input) }),
  issues: (siteId: string) => request<ApiIssue[]>(`/api/sites/${siteId}/issues`),
  issue: (issueId: string) => request<ApiIssue>(`/api/issues/${issueId}`),
  updateIssue: (issueId: string, state: ApiIssue["state"]) => request<ApiIssue>(`/api/issues/${issueId}`, { method: "PATCH", body: JSON.stringify({ state }) }),
  audits: (siteId: string) => request<ApiAuditRun[]>(`/api/sites/${siteId}/audits`),
  startAudit: (siteId: string, mode: ApiAuditRun["mode"]) => request<ApiAuditRun>("/api/audits", { method: "POST", body: JSON.stringify({ siteId, mode }) }),
  audit: (runId: string) => request<ApiAuditRun>(`/api/audits/${runId}`),
  keywords: (siteId: string) => request<TrackedKeyword[]>(`/api/sites/${siteId}/keywords`),
  createKeyword: (input: CreateKeywordRequest) => request<TrackedKeyword>("/api/keywords", { method: "POST", body: JSON.stringify(input) }),
  deleteKeyword: (keywordId: string) => request<void>(`/api/keywords/${keywordId}`, { method: "DELETE" }),
  competitors: (siteId: string) => request<CompetitorSummary[]>(`/api/sites/${siteId}/competitors`),
  createCompetitor: (input: CreateCompetitorRequest) => request<CompetitorSummary>("/api/competitors", { method: "POST", body: JSON.stringify(input) }),
  deleteCompetitor: (competitorId: string) => request<void>(`/api/competitors/${competitorId}`, { method: "DELETE" }),
  adBriefs: (siteId: string) => request<AdBrief[]>(`/api/sites/${siteId}/ad-briefs`),
  createAdBrief: (input: CreateAdBriefRequest) => request<AdBrief>("/api/ad-briefs", { method: "POST", body: JSON.stringify(input) }),
  reports: (siteId: string) => request<Array<{ id: string; title: string; kind: string; status: string; createdAt: string }>>(`/api/sites/${siteId}/reports`),
  createReport: (input: { siteId: string; title: string; kind: "executive" | "technical" | "competitor" | "ads" }) => request<{ id: string }>("/api/reports", { method: "POST", body: JSON.stringify(input) }),
  shareReport: (reportId: string) => request<{ id: string; url: string; expiresAt: string }>(`/api/reports/${reportId}/share`, { method: "POST", body: JSON.stringify({ expiresInDays: 14 }) }),
  auditSchedule: (siteId: string) => request<{ id: string; mode: ApiAuditRun["mode"]; intervalHours: number; enabled: boolean; nextRunAt: string } | null>(`/api/sites/${siteId}/audit-schedule`),
  saveAuditSchedule: (siteId: string, input: { mode: ApiAuditRun["mode"]; intervalHours: number; enabled: boolean }) => request(`/api/sites/${siteId}/audit-schedule`, { method: "PUT", body: JSON.stringify(input) }),
  visibility: (siteId: string) => request<VisibilitySnapshot[]>(`/api/sites/${siteId}/visibility`),
  events: (siteId: string) => request<SiteEvent[]>(`/api/sites/${siteId}/events`),
  intelligence: (siteId: string, module?: string) => request<IntelligenceItem[]>(`/api/sites/${siteId}/intelligence${module ? `?module=${encodeURIComponent(module)}` : ""}`),
  updateIntelligence: (itemId: string, status: "active" | "planned" | "implemented" | "dismissed") => request<IntelligenceItem>(`/api/intelligence/${itemId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  journeys: (siteId: string) => request<Array<JourneyDefinition & { latestRun: JourneyRun | null }>>(`/api/sites/${siteId}/journeys`),
  createJourney: (input: { siteId: string; name: string; startUrl: string; device: "mobile" | "desktop"; locale: string; steps: Array<{ action: "click" | "fill" | "assert_visible" | "assert_url"; selector?: string; value?: string; description: string }> }) => request<JourneyDefinition>("/api/journeys", { method: "POST", body: JSON.stringify(input) }),
  runJourney: (journeyId: string) => request<JourneyRun>(`/api/journeys/${journeyId}/runs`, { method: "POST", body: "{}" }),
  journeyRun: (runId: string) => request<JourneyRun>(`/api/journey-runs/${runId}`),
};
