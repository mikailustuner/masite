import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { ZodError } from "zod";
import { createDatabaseClient, type DatabaseClient } from "@evidera/database";
import { AppError, type ApiEnvironment } from "@evidera/runtime";
import { registerAuthentication } from "./plugins/auth.js";
import { registerOriginProtection } from "./plugins/security.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAuditRoutes } from "./routes/audits.js";
import { registerIssueRoutes } from "./routes/issues.js";
import { registerIntelligenceRoutes } from "./routes/intelligence.js";
import { registerAdsRoutes } from "./routes/ads.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerEvidenceArtifactRoutes } from "./routes/evidenceArtifacts.js";
import { registerSiteRoutes } from "./routes/sites.js";
import { createAuditLogService } from "./services/auditLogService.js";
import { createAuthService } from "./services/authService.js";
import { createQueueService } from "./services/queueService.js";
import "./types.js";

export interface AppDependencies {
  environment: ApiEnvironment;
  database?: DatabaseClient;
}

export async function buildApp(dependencies: AppDependencies): Promise<{ app: FastifyInstance; database: DatabaseClient }> {
  const { environment } = dependencies;
  const database = dependencies.database ?? createDatabaseClient(environment.DATABASE_URL, environment.DATABASE_POOL_MAX);
  const app = Fastify({
    trustProxy: environment.TRUST_PROXY,
    bodyLimit: 64 * 1024,
    logger: {
      level: environment.LOG_LEVEL,
      redact: {
        paths: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"],
        censor: "[REDACTED]",
      },
    },
  });

  await app.register(cookie);
  await app.register(cors, { origin: environment.PUBLIC_APP_URL, credentials: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  const rateLimitRedis = new Redis(environment.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: true });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute", ban: 3, redis: rateLimitRedis });
  app.addHook("onClose", async () => rateLimitRedis.quit());
  await registerOriginProtection(app, { publicAppUrl: environment.PUBLIC_APP_URL, production: environment.NODE_ENV === "production" });

  const authService = createAuthService(database, environment.SESSION_SECRET, environment.SESSION_TTL_HOURS);
  const auditLog = createAuditLogService(database, environment.SESSION_SECRET);
  const queue = createQueueService(environment.REDIS_URL, environment.QUEUE_PREFIX);
  app.addHook("onClose", async () => queue.close());
  await registerAuthentication(app, { authService, cookieName: environment.SESSION_COOKIE_NAME });

  app.get("/api/health/live", async () => ({ status: "ok", service: "evidera-api", version: "0.2.0" }));
  app.get("/api/health/ready", async (_request, reply) => {
    try {
      const [, redisStatus] = await Promise.all([database.sql`select 1`, queue.ping()]);
      return { status: "ready", database: "ok", queue: redisStatus === "PONG" ? "ok" : "error" };
    } catch {
      return reply.code(503).send({ status: "unavailable", database: "error" });
    }
  });

  await registerAuthRoutes(app, { authService, environment });
  await registerAuditRoutes(app, { database, auditLog, queue });
  await registerSiteRoutes(app, { database, auditLog });
  await registerIssueRoutes(app, { database, auditLog });
  await registerIntelligenceRoutes(app, { database, auditLog, queue });
  await registerAdsRoutes(app, { database, auditLog });
  await registerReportRoutes(app, { database, environment, auditLog });
  await registerEvidenceArtifactRoutes(app, { database, environment });

  app.setNotFoundHandler((request, reply) => reply.code(404).type("application/problem+json").send({
    type: "https://evidera.example/problems/not-found",
    title: "Kaynak bulunamadı",
    status: 404,
    detail: "İstenen API kaynağı bulunamadı.",
    code: "ROUTE_NOT_FOUND",
    requestId: request.id,
  }));

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "body";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return reply.code(400).type("application/problem+json").send({
        type: "https://evidera.example/problems/validation",
        title: "Doğrulama hatası",
        status: 400,
        detail: "Gönderilen alanlardan biri veya daha fazlası geçersiz.",
        code: "VALIDATION_FAILED",
        requestId: request.id,
        errors,
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).type("application/problem+json").send({
        type: `https://evidera.example/problems/${error.code.toLowerCase().replaceAll("_", "-")}`,
        title: error.statusCode >= 500 ? "İşlem tamamlanamadı" : error.message,
        status: error.statusCode,
        detail: error.message,
        code: error.code,
        requestId: request.id,
        ...(error.details ? { details: error.details } : {}),
      });
    }
    request.log.error({ error }, "Unhandled request error");
    return reply.code(500).type("application/problem+json").send({
      type: "https://evidera.example/problems/internal",
      title: "Sunucu hatası",
      status: 500,
      detail: "Beklenmeyen bir hata oluştu.",
      code: "INTERNAL_ERROR",
      requestId: request.id,
    });
  });

  return { app, database };
}
