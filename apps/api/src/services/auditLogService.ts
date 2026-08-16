import { auditLogs, withTenant, type DatabaseClient } from "@evidera/database";
import { hashToken } from "@evidera/runtime";
import type { FastifyRequest } from "fastify";

export function createAuditLogService(database: DatabaseClient, secret: string) {
  return {
    async write(request: FastifyRequest, action: string, targetType: string, targetId?: string, metadata: Record<string, unknown> = {}): Promise<void> {
      const auth = request.auth;
      if (!auth) return;
      await withTenant(database.db, auth.organizationId, (transaction) => transaction.insert(auditLogs).values({
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action,
        targetType,
        targetId,
        requestId: request.id,
        ipHash: hashToken(request.ip, secret),
        metadata,
      }));
    },
  };
}

export type AuditLogService = ReturnType<typeof createAuditLogService>;
