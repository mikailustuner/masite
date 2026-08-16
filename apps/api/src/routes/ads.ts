import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { createAdBriefRequestSchema } from "@evidera/contracts";
import { adBriefs, issues, keywords, sites, withTenant, type DatabaseClient } from "@evidera/database";
import { AppError } from "@evidera/runtime";
import { requireRole } from "../plugins/auth.js";
import type { AuditLogService } from "../services/auditLogService.js";

export async function registerAdsRoutes(app: FastifyInstance, options: { database: DatabaseClient; auditLog: AuditLogService }): Promise<void> {
  app.get<{ Params: { siteId: string } }>("/api/sites/:siteId/ad-briefs", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, (tx) => tx.select().from(adBriefs).where(and(eq(adBriefs.organizationId, auth.organizationId), eq(adBriefs.siteId, request.params.siteId))).orderBy(desc(adBriefs.createdAt)).limit(50));
  });

  app.post("/api/ad-briefs", { preHandler: requireRole("analyst") }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const input = createAdBriefRequestSchema.parse(request.body);
    const brief = await withTenant(options.database.db, auth.organizationId, async (tx) => {
      const site = await tx.query.sites.findFirst({ where: and(eq(sites.id, input.siteId), eq(sites.organizationId, auth.organizationId)) });
      if (!site) throw new AppError("Site bulunamadı.", "SITE_NOT_FOUND", 404);
      const terms = await tx.select({ id: keywords.id, term: keywords.term, intent: keywords.intent, targetUrl: keywords.targetUrl }).from(keywords).where(and(eq(keywords.siteId, site.id), eq(keywords.active, true))).orderBy(desc(keywords.searchVolume)).limit(25);
      const findings = await tx.select({ id: issues.id, title: issues.title, recommendation: issues.recommendation, confidence: issues.confidence }).from(issues).where(and(eq(issues.siteId, site.id), sql`${issues.state} not in ('resolved', 'false_positive')`)).orderBy(desc(issues.lastSeenAt)).limit(10);
      const generated = input.platform === "google" ? googleContent(input.offer, terms.map((item) => item.term), site.normalizedHost) : metaContent(input.offer, input.audience);
      const evidenceRefs = [...terms.slice(0, 10).map((item) => ({ type: "keyword", id: item.id, label: item.term, limitation: "Konum/veri sağlayıcısı ölçümü yoksa yalnızca takip terimidir." })), ...findings.slice(0, 5).map((item) => ({ type: "issue", id: item.id, label: item.title, confidence: item.confidence }))];
      return (await tx.insert(adBriefs).values({ organizationId: auth.organizationId, siteId: site.id, createdByUserId: auth.userId, platform: input.platform, name: input.name, objective: input.objective, audience: input.audience, offer: input.offer, content: generated, evidenceRefs }).returning())[0];
    });
    if (!brief) throw new AppError("Brief oluşturulamadı.", "AD_BRIEF_CREATE_FAILED", 500);
    await options.auditLog.write(request, "ad_brief.created", "ad_brief", brief.id, { siteId: brief.siteId, platform: brief.platform });
    return reply.code(201).send(brief);
  });
}

function fit(value: string, maximum: number): string { return value.length <= maximum ? value : `${value.slice(0, maximum - 1).trim()}…`; }
function googleContent(offer: string, terms: string[], host: string) {
  const seed = terms.slice(0, 5);
  return { campaignType: "search", adGroups: seed.length ? seed.map((term) => ({ name: fit(term, 40), keywords: [term], headlines: [fit(term, 30), fit(offer, 30), "Detayları İnceleyin"], descriptions: [fit(`${offer}. Ayrıntıları ve koşulları inceleyin.`, 90), fit(`${host} üzerinde seçenekleri karşılaştırın.`, 90)], finalUrl: `https://${host}/` })) : [], negativeKeywordHypotheses: [], constraints: { headline: 30, description: 90 }, disclaimer: "Bu bir taslaktır. Hacim, CPC, dönüşüm ve politika uygunluğu Ads hesabı olmadan doğrulanamaz." };
}
function metaContent(offer: string, audience: string) {
  return { campaignType: "meta", concepts: [{ angle: "Fayda", hook: fit(`${audience}: ${offer}`, 125), primaryText: fit(`${offer}. Detayları inceleyin ve size uygun olup olmadığına karar verin.`, 500), headline: fit(offer, 40), cta: "LEARN_MORE" }, { angle: "Karşılaştırma", hook: fit(`${offer} seçeneklerini karşılaştırın`, 125), primaryText: fit(`İhtiyacınıza uygun seçeneği kanıta dayalı bilgilerle değerlendirin. ${offer}`, 500), headline: "Seçenekleri İnceleyin", cta: "LEARN_MORE" }], testPlan: { variable: "angle", primaryMetric: "landing_page_view", guardrails: ["frequency", "negative_feedback"] }, disclaimer: "Kreatif ve hedefleme hipotezidir. Meta hesap performansı veya politika onayı iddia edilmez." };
}
