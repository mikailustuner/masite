import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { createDatabaseClient } from "@evidera/database";
import { AUDIT_QUEUE_NAME, JOURNEY_QUEUE_NAME, parseWorkerEnvironment } from "@evidera/runtime";
import { createAuditProcessor } from "./processAudit.js";
import { createEvidenceStore } from "./services/evidenceStore.js";
import { createScheduler } from "./scheduler.js";
import { createJourneyProcessor } from "./processJourney.js";

const environment = parseWorkerEnvironment(process.env);
const database = createDatabaseClient(environment.DATABASE_URL, environment.DATABASE_POOL_MAX);
const redis = new Redis(environment.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
const evidenceStore = createEvidenceStore(environment);
const processor = createAuditProcessor({ database, environment, evidenceStore });
const worker = new Worker(AUDIT_QUEUE_NAME, processor, {
  connection: redis,
  prefix: environment.QUEUE_PREFIX,
  concurrency: 2,
  lockDuration: 5 * 60 * 1000,
  stalledInterval: 30_000,
  maxStalledCount: 1,
});
const journeyWorker = new Worker(JOURNEY_QUEUE_NAME, createJourneyProcessor({ database, environment, evidenceStore }), { connection: redis, prefix: environment.QUEUE_PREFIX, concurrency: 1, lockDuration: 5 * 60 * 1000, stalledInterval: 30_000, maxStalledCount: 1 });
const scheduler = createScheduler({ database, environment, redis });
scheduler.start();

worker.on("completed", (job, result) => process.stdout.write(`${JSON.stringify({ level: "info", event: "audit.completed", jobId: job.id, result })}\n`));
worker.on("failed", (job, error) => process.stderr.write(`${JSON.stringify({ level: "error", event: "audit.failed", jobId: job?.id, error: error.message })}\n`));
worker.on("error", (error) => process.stderr.write(`${JSON.stringify({ level: "error", event: "worker.error", error: error.message })}\n`));
journeyWorker.on("completed", (job, result) => process.stdout.write(`${JSON.stringify({ level: "info", event: "journey.completed", jobId: job.id, result })}\n`));
journeyWorker.on("failed", (job, error) => process.stderr.write(`${JSON.stringify({ level: "error", event: "journey.failed", jobId: job?.id, error: error.message })}\n`));

async function shutdown(signal: string): Promise<void> {
  process.stdout.write(`${JSON.stringify({ level: "info", event: "worker.shutdown", signal })}\n`);
  await worker.close();
  await journeyWorker.close();
  await scheduler.close();
  await redis.quit();
  await database.close();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
