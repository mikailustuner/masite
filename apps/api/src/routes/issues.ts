import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { updateIssueRequestSchema } from "@evidera/contracts";
import { evidence, issues, sites, withTenant, type DatabaseClient } from "@evidera/database";
import { AppError } from "@evidera/runtime";
import { requireRole } from "../plugins/auth.js";
import type { AuditLogService } from "../services/auditLogService.js";

export async function registerIssueRoutes(app: FastifyInstance, options: { database: DatabaseClient; auditLog: AuditLogService }): Promise<void> {
  app.get<{ Params: { siteId: string } }>("/api/sites/:siteId/issues", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, async (transaction) => {
      const site = await transaction.query.sites.findFirst({ where: and(eq(sites.id, request.params.siteId), eq(sites.organizationId, auth.organizationId)), columns: { id: true } });
      if (!site) throw new AppError("Site bulunamadı.", "SITE_NOT_FOUND", 404);
      return transaction.select().from(issues).where(and(eq(issues.siteId, site.id), eq(issues.organizationId, auth.organizationId))).orderBy(desc(issues.lastSeenAt));
    });
  });

  app.get<{ Params: { issueId: string } }>("/api/issues/:issueId", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, async (transaction) => {
      const issue = await transaction.query.issues.findFirst({ where: and(eq(issues.id, request.params.issueId), eq(issues.organizationId, auth.organizationId)) });
      if (!issue) throw new AppError("Sorun bulunamadı.", "ISSUE_NOT_FOUND", 404);
      const evidenceRows = await transaction.select().from(evidence).where(eq(evidence.issueId, issue.id)).orderBy(desc(evidence.capturedAt));
      return { ...issue, evidence: evidenceRows };
    });
  });

  app.patch<{ Params: { issueId: string } }>("/api/issues/:issueId", { preHandler: requireRole("analyst") }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const input = updateIssueRequestSchema.parse(request.body);
    const issue = await withTenant(options.database.db, auth.organizationId, async (transaction) => {
      const [updated] = await transaction.update(issues).set({
        ...(input.state ? { state: input.state, resolvedAt: input.state === "resolved" ? new Date() : null } : {}),
        ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
        updatedAt: new Date(),
      }).where(and(eq(issues.id, request.params.issueId), eq(issues.organizationId, auth.organizationId))).returning();
      return updated;
    });
    if (!issue) throw new AppError("Sorun bulunamadı.", "ISSUE_NOT_FOUND", 404);
    await options.auditLog.write(request, "issue.updated", "issue", issue.id, input);
    return issue;
  });
}
