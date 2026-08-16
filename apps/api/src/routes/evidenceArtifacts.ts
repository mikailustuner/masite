import type { FastifyInstance, FastifyReply } from "fastify";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import { evidence, journeyRuns, withTenant, type DatabaseClient } from "@evidera/database";
import { AppError, type ApiEnvironment } from "@evidera/runtime";
import { requireRole } from "../plugins/auth.js";

export async function registerEvidenceArtifactRoutes(app: FastifyInstance, options: { database: DatabaseClient; environment: ApiEnvironment }): Promise<void> {
  const s3 = new S3Client({ endpoint: options.environment.S3_ENDPOINT, region: options.environment.S3_REGION, forcePathStyle: options.environment.S3_FORCE_PATH_STYLE, credentials: { accessKeyId: options.environment.S3_ACCESS_KEY, secretAccessKey: options.environment.S3_SECRET_KEY } });
  app.get<{ Params: { evidenceId: string } }>("/api/evidence/:evidenceId/artifact", { preHandler: requireRole() }, async (request, reply) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const row = await withTenant(options.database.db, auth.organizationId, (tx) => tx.query.evidence.findFirst({ where: and(eq(evidence.id, request.params.evidenceId), eq(evidence.organizationId, auth.organizationId)) }));
    if (!row?.artifactKey) throw new AppError("Kanıt dosyası bulunamadı.", "EVIDENCE_ARTIFACT_NOT_FOUND", 404);
    return sendArtifact(s3, options.environment.S3_BUCKET, row.artifactKey, row.kind === "screenshot" ? "image/jpeg" : "application/octet-stream", `evidence-${row.id}`, reply);
  });
  app.get<{ Params: { runId: string; step: string } }>("/api/journey-runs/:runId/artifacts/:step", { preHandler: requireRole() }, async (request, reply) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const run = await withTenant(options.database.db, auth.organizationId, (tx) => tx.query.journeyRuns.findFirst({ where: and(eq(journeyRuns.id, request.params.runId), eq(journeyRuns.organizationId, auth.organizationId)) }));
    const step = Number(request.params.step);
    const steps = Array.isArray(run?.result.steps) ? run.result.steps as Array<Record<string, unknown>> : [];
    const artifactKey = steps.find((item) => item.step === step)?.screenshotKey;
    if (typeof artifactKey !== "string") throw new AppError("Yolculuk kanıtı bulunamadı.", "JOURNEY_ARTIFACT_NOT_FOUND", 404);
    return sendArtifact(s3, options.environment.S3_BUCKET, artifactKey, "image/jpeg", `journey-${request.params.runId}-step-${step}`, reply);
  });
  app.addHook("onClose", async () => s3.destroy());
}

async function sendArtifact(s3: S3Client, bucket: string, key: string, fallbackType: string, filename: string, reply: FastifyReply) {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) throw new AppError("Kanıt dosyası bulunamadı.", "EVIDENCE_ARTIFACT_NOT_FOUND", 404);
  reply.header("content-type", object.ContentType ?? fallbackType).header("cache-control", "private, no-store").header("content-disposition", `inline; filename="${filename}.jpg"`);
  return reply.send(object.Body as NodeJS.ReadableStream);
}
