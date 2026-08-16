import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createAuditRequestSchema, upsertAuditScheduleRequestSchema } from "@evidera/contracts";
import { auditRuns, auditSchedules, sites, withTenant, type DatabaseClient } from "@evidera/database";
import { AppError } from "@evidera/runtime";
import { requireRole } from "../plugins/auth.js";
import type { AuditLogService } from "../services/auditLogService.js";
import type { QueueService } from "../services/queueService.js";

export async function registerAuditRoutes(app: FastifyInstance, options: { database: DatabaseClient; auditLog: AuditLogService; queue: QueueService }): Promise<void> {
  app.post("/api/audits", { preHandler: requireRole("analyst"), config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const input = createAuditRequestSchema.parse(request.body);
    const run = await withTenant(options.database.db, auth.organizationId, async (transaction) => {
      const site = await transaction.query.sites.findFirst({ where: and(eq(sites.id, input.siteId), eq(sites.organizationId, auth.organizationId), eq(sites.status, "active")), columns: { id: true } });
      if (!site) throw new AppError("Etkin site bulunamadı.", "SITE_NOT_FOUND", 404);
      const activeRun = await transaction.query.auditRuns.findFirst({ where: and(eq(auditRuns.siteId, site.id), eq(auditRuns.organizationId, auth.organizationId), inArray(auditRuns.status, ["queued", "running"])) });
      if (activeRun) throw new AppError("Bu site için bir denetim zaten arka planda çalışıyor.", "AUDIT_ALREADY_RUNNING", 409);
      const [created] = await transaction.insert(auditRuns).values({
        organizationId: auth.organizationId,
        siteId: site.id,
        requestedByUserId: auth.userId,
        mode: input.mode,
        analyzerVersion: "crawler/0.2.0",
      }).returning();
      return created;
    });
    if (!run) throw new AppError("Tarama oluşturulamadı.", "AUDIT_CREATE_FAILED", 500);
    try {
      await options.queue.enqueueAudit({ runId: run.id, organizationId: auth.organizationId, siteId: run.siteId, mode: run.mode });
    } catch (error) {
      await withTenant(options.database.db, auth.organizationId, (transaction) => transaction.update(auditRuns).set({ status: "failed", completedAt: new Date(), errorCode: "QUEUE_UNAVAILABLE", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Queue unavailable" }).where(eq(auditRuns.id, run.id)));
      throw new AppError("Tarama kuyruğa eklenemedi.", "QUEUE_UNAVAILABLE", 503);
    }
    await options.auditLog.write(request, "audit.queued", "audit_run", run.id, { siteId: run.siteId, mode: run.mode });
    return reply.code(202).send(run);
  });

  app.get<{ Params: { runId: string } }>("/api/audits/:runId", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const run = await withTenant(options.database.db, auth.organizationId, (transaction) => transaction.query.auditRuns.findFirst({ where: and(eq(auditRuns.id, request.params.runId), eq(auditRuns.organizationId, auth.organizationId)) }));
    if (!run) throw new AppError("Tarama bulunamadı.", "AUDIT_NOT_FOUND", 404);
    return run;
  });

  app.get("/api/audits/active", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, (transaction) => transaction.select().from(auditRuns).where(and(eq(auditRuns.organizationId, auth.organizationId), inArray(auditRuns.status, ["queued", "running"]))).orderBy(desc(auditRuns.queuedAt)).limit(100));
  });

  app.get<{ Params: { siteId: string } }>("/api/sites/:siteId/audits", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, (transaction) => transaction.select().from(auditRuns).where(and(eq(auditRuns.organizationId, auth.organizationId), eq(auditRuns.siteId, request.params.siteId))).orderBy(desc(auditRuns.queuedAt)).limit(50));
  });

  app.get<{ Params: { siteId: string } }>("/api/sites/:siteId/audit-schedule", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, (transaction) => transaction.query.auditSchedules.findFirst({ where: and(eq(auditSchedules.siteId, request.params.siteId), eq(auditSchedules.organizationId, auth.organizationId)) }));
  });

  app.put<{ Params: { siteId: string } }>("/api/sites/:siteId/audit-schedule", { preHandler: requireRole("consultant") }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const input = upsertAuditScheduleRequestSchema.parse(request.body);
    const schedule = await withTenant(options.database.db, auth.organizationId, async (transaction) => {
      const site = await transaction.query.sites.findFirst({ where: and(eq(sites.id, request.params.siteId), eq(sites.organizationId, auth.organizationId)), columns: { id: true } });
      if (!site) throw new AppError("Site bulunamadı.", "SITE_NOT_FOUND", 404);
      return (await transaction.insert(auditSchedules).values({ organizationId: auth.organizationId, siteId: site.id, ...input, nextRunAt: new Date(Date.now() + input.intervalHours * 3_600_000) }).onConflictDoUpdate({ target: auditSchedules.siteId, set: { ...input, nextRunAt: new Date(Date.now() + input.intervalHours * 3_600_000), updatedAt: new Date() } }).returning())[0];
    });
    if (!schedule) throw new AppError("Zamanlama kaydedilemedi.", "SCHEDULE_SAVE_FAILED", 500);
    await options.auditLog.write(request, "audit_schedule.updated", "audit_schedule", schedule.id, input);
    return schedule;
  });
}
