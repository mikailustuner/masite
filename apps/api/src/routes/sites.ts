import type { FastifyInstance } from "fastify";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { createSiteRequestSchema } from "@evidera/contracts";
import { issues, keywords, rankObservations, sites, withTenant, type DatabaseClient } from "@evidera/database";
import { AppError } from "@evidera/runtime";
import { normalizePublicUrl } from "../urlSafety.js";
import { requireRole } from "../plugins/auth.js";
import type { AuditLogService } from "../services/auditLogService.js";

export async function registerSiteRoutes(app: FastifyInstance, options: { database: DatabaseClient; auditLog: AuditLogService }): Promise<void> {
  app.get("/api/sites", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, async (transaction) => {
      const siteRows = await transaction.select().from(sites).where(and(eq(sites.organizationId, auth.organizationId), eq(sites.status, "active"))).orderBy(sites.name);
      if (siteRows.length === 0) return [];
      const issueCounts = await transaction
        .select({
          siteId: issues.siteId,
          openIssues: count(),
          criticalIssues: sql<number>`count(*) filter (where ${issues.severity} = 'critical')`,
        })
        .from(issues)
        .where(and(inArray(issues.siteId, siteRows.map((site) => site.id)), sql`${issues.state} not in ('resolved', 'false_positive')`))
        .groupBy(issues.siteId);
      const countsBySite = new Map(issueCounts.map((row) => [row.siteId, row]));
      const trackedKeywords = await transaction.select({ id: keywords.id, siteId: keywords.siteId }).from(keywords).where(and(inArray(keywords.siteId, siteRows.map((site) => site.id)), eq(keywords.active, true)));
      const latestRanks = trackedKeywords.length ? await transaction.select().from(rankObservations).where(inArray(rankObservations.keywordId, trackedKeywords.map((item) => item.id))).orderBy(desc(rankObservations.capturedAt)) : [];
      const latestByKeyword = new Map<string, number | null>();
      for (const rank of latestRanks) if (!latestByKeyword.has(rank.keywordId)) latestByKeyword.set(rank.keywordId, rank.position);
      const keywordsBySite = new Map<string, typeof trackedKeywords>();
      for (const keyword of trackedKeywords) keywordsBySite.set(keyword.siteId, [...(keywordsBySite.get(keyword.siteId) ?? []), keyword]);

      return siteRows.map((site) => {
        const counts = countsBySite.get(site.id);
        const openIssues = Number(counts?.openIssues ?? 0);
        const criticalIssues = Number(counts?.criticalIssues ?? 0);
        const healthScore = Math.max(0, 100 - criticalIssues * 12 - Math.max(0, openIssues - criticalIssues) * 1.5);
        const latestScores = typeof site.settings.latestScores === "object" && site.settings.latestScores !== null ? site.settings.latestScores as Record<string, unknown> : {};
        const siteKeywords = keywordsBySite.get(site.id) ?? [];
        const measuredPositions = siteKeywords.map((keyword) => latestByKeyword.get(keyword.id)).filter((position): position is number => typeof position === "number");
        const visibilityScore = siteKeywords.length && measuredPositions.length ? Math.round((measuredPositions.reduce((sum, position) => sum + (100 / Math.log2(position + 1)), 0) / siteKeywords.length) * 10) / 10 : null;
        return {
          id: site.id,
          name: site.name,
          domain: site.normalizedHost,
          origin: site.origin,
          market: site.market,
          language: site.language,
          healthScore: Math.round(healthScore),
          visibilityScore,
          accessibilityScore: typeof latestScores.accessibility === "number" ? latestScores.accessibility : null,
          performanceScore: typeof latestScores.performance === "number" ? latestScores.performance : null,
          openIssues,
          criticalIssues,
          trend: null,
          lastScanAt: site.lastAuditAt?.toISOString() ?? null,
          status: criticalIssues > 0 ? "critical" : openIssues > 10 ? "attention" : "healthy",
        };
      });
    });
  });

  app.post("/api/sites", { preHandler: requireRole("consultant") }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const input = createSiteRequestSchema.parse(request.body);
    const normalized = normalizePublicUrl(input.origin);
    normalized.pathname = "/";
    normalized.search = "";
    normalized.hash = "";
    const origin = normalized.origin;

    const site = await withTenant(options.database.db, auth.organizationId, async (transaction) => {
      const [created] = await transaction.insert(sites).values({
        organizationId: auth.organizationId,
        name: input.name,
        origin,
        normalizedHost: normalized.hostname,
        market: input.market,
        language: input.language,
      }).returning();
      return created;
    });
    if (!site) throw new AppError("Site oluşturulamadı.", "SITE_CREATE_FAILED", 500);
    await options.auditLog.write(request, "site.created", "site", site.id, { origin: site.origin });
    return reply.code(201).send(site);
  });

  app.get<{ Params: { siteId: string } }>("/api/sites/:siteId", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const site = await withTenant(options.database.db, auth.organizationId, (transaction) => transaction.query.sites.findFirst({ where: and(eq(sites.id, request.params.siteId), eq(sites.organizationId, auth.organizationId)) }));
    if (!site) throw new AppError("Site bulunamadı.", "SITE_NOT_FOUND", 404);
    return site;
  });
}
