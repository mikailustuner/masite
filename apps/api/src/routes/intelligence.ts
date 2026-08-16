import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { createCompetitorRequestSchema, createJourneyRequestSchema, createKeywordRequestSchema, intelligenceModules } from "@evidera/contracts";
import { competitors, intelligenceItems, journeyDefinitions, journeyRuns, keywords, rankObservations, siteEvents, sites, withTenant, type DatabaseClient } from "@evidera/database";
import { AppError } from "@evidera/runtime";
import { z } from "zod";
import { requireRole } from "../plugins/auth.js";
import type { AuditLogService } from "../services/auditLogService.js";
import { normalizePublicUrl } from "../urlSafety.js";
import type { QueueService } from "../services/queueService.js";

export async function registerIntelligenceRoutes(app: FastifyInstance, options: { database: DatabaseClient; auditLog: AuditLogService; queue: QueueService }): Promise<void> {
  app.get<{ Params: { siteId: string }; Querystring: { limit?: string } }>("/api/sites/:siteId/events", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const limit = z.coerce.number().int().min(1).max(500).default(200).parse(request.query.limit);
    return withTenant(options.database.db, auth.organizationId, async (tx) => { await assertSite(tx, auth.organizationId, request.params.siteId); return tx.select().from(siteEvents).where(and(eq(siteEvents.organizationId, auth.organizationId), eq(siteEvents.siteId, request.params.siteId))).orderBy(desc(siteEvents.capturedAt)).limit(limit); });
  });

  app.get<{ Params: { siteId: string }; Querystring: { module?: string; status?: string } }>("/api/sites/:siteId/intelligence", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const module = request.query.module ? z.enum(intelligenceModules).parse(request.query.module) : null;
    const status = z.enum(["active", "planned", "implemented", "dismissed"]).default("active").parse(request.query.status);
    return withTenant(options.database.db, auth.organizationId, async (tx) => { await assertSite(tx, auth.organizationId, request.params.siteId); return tx.select().from(intelligenceItems).where(and(eq(intelligenceItems.organizationId, auth.organizationId), eq(intelligenceItems.siteId, request.params.siteId), eq(intelligenceItems.status, status), ...(module ? [eq(intelligenceItems.module, module)] : []))).orderBy(desc(intelligenceItems.priority), desc(intelligenceItems.lastSeenAt)).limit(500); });
  });

  app.patch<{ Params: { itemId: string } }>("/api/intelligence/:itemId", { preHandler: requireRole("analyst") }, async (request) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const input = z.object({ status: z.enum(["active", "planned", "implemented", "dismissed"]) }).parse(request.body);
    const row = await withTenant(options.database.db, auth.organizationId, async (tx) => (await tx.update(intelligenceItems).set({ status: input.status, updatedAt: new Date() }).where(and(eq(intelligenceItems.id, request.params.itemId), eq(intelligenceItems.organizationId, auth.organizationId))).returning())[0]);
    if (!row) throw new AppError("Intelligence öğesi bulunamadı.", "INTELLIGENCE_NOT_FOUND", 404);
    await options.auditLog.write(request, "intelligence.status.updated", "intelligence_item", row.id, input); return row;
  });

  app.get<{ Params: { siteId: string } }>("/api/sites/:siteId/journeys", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, async (tx) => { await assertSite(tx, auth.organizationId, request.params.siteId); const definitions = await tx.select().from(journeyDefinitions).where(and(eq(journeyDefinitions.organizationId, auth.organizationId), eq(journeyDefinitions.siteId, request.params.siteId))).orderBy(journeyDefinitions.name); const runs = await tx.select().from(journeyRuns).where(and(eq(journeyRuns.organizationId, auth.organizationId), eq(journeyRuns.siteId, request.params.siteId))).orderBy(desc(journeyRuns.queuedAt)); const latest = new Map<string, typeof runs[number]>(); for (const run of runs) if (!latest.has(run.journeyId)) latest.set(run.journeyId, run); return definitions.map((definition) => ({ ...definition, latestRun: latest.get(definition.id) ?? null })); });
  });

  app.post("/api/journeys", { preHandler: requireRole("analyst") }, async (request, reply) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const input = createJourneyRequestSchema.parse(request.body);
    const start = normalizePublicUrl(input.startUrl);
    const row = await withTenant(options.database.db, auth.organizationId, async (tx) => { const site = await tx.query.sites.findFirst({ where: and(eq(sites.id, input.siteId), eq(sites.organizationId, auth.organizationId)) }); if (!site) throw new AppError("Site bulunamadı.", "SITE_NOT_FOUND", 404); if (new URL(site.origin).origin !== start.origin) throw new AppError("Yolculuk yalnızca site origin’i içinde başlayabilir.", "JOURNEY_CROSS_ORIGIN", 400); return (await tx.insert(journeyDefinitions).values({ organizationId: auth.organizationId, ...input, startUrl: start.toString(), safety: { allowSubmit: false, maxSteps: 12 } }).returning())[0]; });
    if (!row) throw new AppError("Yolculuk oluşturulamadı.", "JOURNEY_CREATE_FAILED", 500); await options.auditLog.write(request, "journey.created", "journey", row.id, { siteId: row.siteId }); return reply.code(201).send(row);
  });

  app.post<{ Params: { journeyId: string } }>("/api/journeys/:journeyId/runs", { preHandler: requireRole("analyst") }, async (request, reply) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const run = await withTenant(options.database.db, auth.organizationId, async (tx) => { const journey = await tx.query.journeyDefinitions.findFirst({ where: and(eq(journeyDefinitions.id, request.params.journeyId), eq(journeyDefinitions.organizationId, auth.organizationId)) }); if (!journey) throw new AppError("Yolculuk bulunamadı.", "JOURNEY_NOT_FOUND", 404); return (await tx.insert(journeyRuns).values({ organizationId: auth.organizationId, siteId: journey.siteId, journeyId: journey.id }).returning())[0]; });
    if (!run) throw new AppError("Yolculuk koşusu oluşturulamadı.", "JOURNEY_RUN_CREATE_FAILED", 500);
    try { await options.queue.enqueueJourney({ runId: run.id, journeyId: run.journeyId, organizationId: auth.organizationId, siteId: run.siteId }); } catch (error) { await withTenant(options.database.db, auth.organizationId, (tx) => tx.update(journeyRuns).set({ status: "failed", completedAt: new Date(), errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Queue failed" }).where(eq(journeyRuns.id, run.id))); throw new AppError("Yolculuk kuyruğa alınamadı.", "JOURNEY_QUEUE_FAILED", 503); }
    await options.auditLog.write(request, "journey.run.queued", "journey_run", run.id, { journeyId: run.journeyId }); return reply.code(202).send(run);
  });

  app.get<{ Params: { runId: string } }>("/api/journey-runs/:runId", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const run = await withTenant(options.database.db, auth.organizationId, (tx) => tx.query.journeyRuns.findFirst({ where: and(eq(journeyRuns.id, request.params.runId), eq(journeyRuns.organizationId, auth.organizationId)) }));
    if (!run) throw new AppError("Yolculuk koşusu bulunamadı.", "JOURNEY_RUN_NOT_FOUND", 404); return run;
  });
  app.get<{ Params: { siteId: string } }>("/api/sites/:siteId/keywords", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, async (tx) => {
      await assertSite(tx, auth.organizationId, request.params.siteId);
      const rows = await tx.select().from(keywords).where(and(eq(keywords.organizationId, auth.organizationId), eq(keywords.siteId, request.params.siteId), eq(keywords.active, true))).orderBy(keywords.term);
      const ids = rows.map((row) => row.id);
      const observations = ids.length ? await tx.select().from(rankObservations).where(inArray(rankObservations.keywordId, ids)).orderBy(desc(rankObservations.capturedAt)) : [];
      const byKeyword = new Map<string, typeof observations>();
      for (const observation of observations) byKeyword.set(observation.keywordId, [...(byKeyword.get(observation.keywordId) ?? []), observation]);
      return rows.map((row) => ({ ...row, position: byKeyword.get(row.id)?.[0]?.position ?? null, previousPosition: byKeyword.get(row.id)?.[1]?.position ?? null, capturedAt: byKeyword.get(row.id)?.[0]?.capturedAt.toISOString() ?? null, provider: byKeyword.get(row.id)?.[0]?.provider ?? null }));
    });
  });

  app.post("/api/keywords", { preHandler: requireRole("analyst") }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const input = createKeywordRequestSchema.parse(request.body);
    const row = await withTenant(options.database.db, auth.organizationId, async (tx) => {
      await assertSite(tx, auth.organizationId, input.siteId);
      const [created] = await tx.insert(keywords).values({ organizationId: auth.organizationId, ...input }).returning();
      return created;
    });
    if (!row) throw new AppError("Keyword oluşturulamadı.", "KEYWORD_CREATE_FAILED", 500);
    await options.auditLog.write(request, "keyword.created", "keyword", row.id, { siteId: row.siteId, term: row.term });
    return reply.code(201).send(row);
  });

  app.get<{ Params: { siteId: string } }>("/api/sites/:siteId/visibility", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, async (tx) => {
      await assertSite(tx, auth.organizationId, request.params.siteId);
      const tracked = await tx.select({ id: keywords.id }).from(keywords).where(and(eq(keywords.siteId, request.params.siteId), eq(keywords.active, true)));
      if (!tracked.length) return [];
      const rows = await tx.select().from(rankObservations).where(and(inArray(rankObservations.keywordId, tracked.map((item) => item.id)), gte(rankObservations.capturedAt, new Date(Date.now() - 90 * 86_400_000)))).orderBy(rankObservations.capturedAt);
      const daily = new Map<string, Map<string, number | null>>();
      for (const row of rows) { const day = row.capturedAt.toISOString().slice(0, 10); const values = daily.get(day) ?? new Map<string, number | null>(); values.set(row.keywordId, row.position); daily.set(day, values); }
      return [...daily].map(([date, values]) => { const positions = [...values.values()].filter((value): value is number => value !== null); const score = positions.length ? positions.reduce((sum, position) => sum + (100 / Math.log2(position + 1)), 0) / tracked.length : 0; return { date, score: Math.round(score * 10) / 10, top3: positions.filter((position) => position <= 3).length, top10: positions.filter((position) => position <= 10).length, tracked: tracked.length, measured: positions.length }; });
    });
  });

  app.delete<{ Params: { keywordId: string } }>("/api/keywords/:keywordId", { preHandler: requireRole("analyst") }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const row = await withTenant(options.database.db, auth.organizationId, async (tx) => (await tx.update(keywords).set({ active: false, updatedAt: new Date() }).where(and(eq(keywords.id, request.params.keywordId), eq(keywords.organizationId, auth.organizationId))).returning())[0]);
    if (!row) throw new AppError("Keyword bulunamadı.", "KEYWORD_NOT_FOUND", 404);
    await options.auditLog.write(request, "keyword.archived", "keyword", row.id, {});
    return reply.code(204).send();
  });

  app.get<{ Params: { siteId: string } }>("/api/sites/:siteId/competitors", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, async (tx) => {
      await assertSite(tx, auth.organizationId, request.params.siteId);
      const rows = await tx.select().from(competitors).where(and(eq(competitors.organizationId, auth.organizationId), eq(competitors.siteId, request.params.siteId))).orderBy(competitors.name);
      return rows.map((row) => ({ ...row, visibility: null, overlap: null, top10: null }));
    });
  });

  app.post("/api/competitors", { preHandler: requireRole("analyst") }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const input = createCompetitorRequestSchema.parse(request.body);
    const normalized = normalizePublicUrl(input.origin); normalized.pathname = "/"; normalized.search = ""; normalized.hash = "";
    const row = await withTenant(options.database.db, auth.organizationId, async (tx) => {
      await assertSite(tx, auth.organizationId, input.siteId);
      const [created] = await tx.insert(competitors).values({ organizationId: auth.organizationId, siteId: input.siteId, name: input.name, origin: normalized.origin, kind: input.kind }).returning();
      return created;
    });
    if (!row) throw new AppError("Rakip oluşturulamadı.", "COMPETITOR_CREATE_FAILED", 500);
    await options.auditLog.write(request, "competitor.created", "competitor", row.id, { siteId: row.siteId, origin: row.origin });
    return reply.code(201).send(row);
  });

  app.delete<{ Params: { competitorId: string } }>("/api/competitors/:competitorId", { preHandler: requireRole("analyst") }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const row = await withTenant(options.database.db, auth.organizationId, async (tx) => (await tx.delete(competitors).where(and(eq(competitors.id, request.params.competitorId), eq(competitors.organizationId, auth.organizationId))).returning())[0]);
    if (!row) throw new AppError("Rakip bulunamadı.", "COMPETITOR_NOT_FOUND", 404);
    await options.auditLog.write(request, "competitor.deleted", "competitor", row.id, {});
    return reply.code(204).send();
  });
}

async function assertSite(tx: Parameters<Parameters<typeof withTenant>[2]>[0], organizationId: string, siteId: string): Promise<void> {
  const site = await tx.query.sites.findFirst({ where: and(eq(sites.id, siteId), eq(sites.organizationId, organizationId)), columns: { id: true } });
  if (!site) throw new AppError("Site bulunamadı.", "SITE_NOT_FOUND", 404);
}
