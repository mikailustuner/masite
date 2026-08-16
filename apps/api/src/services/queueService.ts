import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { AUDIT_QUEUE_NAME, JOURNEY_QUEUE_NAME } from "@evidera/runtime";

export interface AuditJobData {
  runId: string;
  organizationId: string;
  siteId: string;
  mode: "quick" | "standard" | "deep";
}

export interface JourneyJobData { runId: string; journeyId: string; organizationId: string; siteId: string }

export function createQueueService(redisUrl: string, prefix: string) {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
  const auditQueue = new Queue<AuditJobData>(AUDIT_QUEUE_NAME, { connection: redis, prefix });
  const journeyQueue = new Queue<JourneyJobData>(JOURNEY_QUEUE_NAME, { connection: redis, prefix });
  return {
    async enqueueAudit(data: AuditJobData): Promise<void> {
      await auditQueue.add("crawl", data, {
        jobId: data.runId,
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
      });
    },
    async enqueueJourney(data: JourneyJobData): Promise<void> {
      await journeyQueue.add("journey", data, { jobId: data.runId, attempts: 2, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: { age: 86_400, count: 1000 }, removeOnFail: { age: 604_800, count: 5000 } });
    },
    ping: () => redis.ping(),
    async close(): Promise<void> {
      await auditQueue.close();
      await journeyQueue.close();
      await redis.quit();
    },
  };
}

export type QueueService = ReturnType<typeof createQueueService>;
