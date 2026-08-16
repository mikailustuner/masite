import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { and, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { auditRuns, auditSchedules, keywords, organizations, rankObservations, sessions, sites, type DatabaseClient, withTenant } from "@evidera/database";
import { AUDIT_QUEUE_NAME, type WorkerEnvironment } from "@evidera/runtime";
import { createSerpProvider } from "./services/serpProvider.js";

export function createScheduler(input: { database: DatabaseClient; environment: WorkerEnvironment; redis: Redis }) {
  const queue = new Queue(AUDIT_QUEUE_NAME, { connection: input.redis, prefix: input.environment.QUEUE_PREFIX });
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  const serpProvider = createSerpProvider(input.environment);
  const tick = async () => {
    if (running) return;
    running = true;
    const lockKey = `${input.environment.QUEUE_PREFIX}:scheduler:lock`;
    const token = `${process.pid}-${Date.now()}`;
    try {
      const locked = await input.redis.set(lockKey, token, "EX", 55, "NX");
      if (!locked) return;
      const due = await input.database.db.transaction(async (tx) => {
        await tx.execute("select set_config('app.evidera_scheduler', 'true', true)");
        return tx.select().from(auditSchedules).where(and(eq(auditSchedules.enabled, true), lte(auditSchedules.nextRunAt, new Date()))).limit(100);
      });
      await input.database.db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
      if (serpProvider) await refreshRanks(input.database, serpProvider);
      for (const schedule of due) {
        const run = await withTenant(input.database.db, schedule.organizationId, async (tx) => {
          const [created] = await tx.insert(auditRuns).values({ organizationId: schedule.organizationId, siteId: schedule.siteId, mode: schedule.mode, analyzerVersion: "crawler/0.2.0" }).returning();
          if (created) await tx.update(auditSchedules).set({ lastRunAt: new Date(), nextRunAt: new Date(Date.now() + schedule.intervalHours * 3_600_000), updatedAt: new Date() }).where(eq(auditSchedules.id, schedule.id));
          return created;
        });
        if (run) {
          try { await queue.add("crawl", { runId: run.id, organizationId: run.organizationId, siteId: run.siteId, mode: run.mode }, { jobId: run.id, attempts: 3, backoff: { type: "exponential", delay: 10_000 }, removeOnComplete: { age: 86_400, count: 1000 }, removeOnFail: { age: 604_800, count: 5000 } }); }
          catch (error) { await withTenant(input.database.db, run.organizationId, (tx) => tx.update(auditRuns).set({ status: "failed", completedAt: new Date(), errorCode: "SCHEDULER_QUEUE_FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Queue failed" }).where(eq(auditRuns.id, run.id))); }
        }
      }
    } catch (error) {
      process.stderr.write(`${JSON.stringify({ level: "error", event: "scheduler.error", error: error instanceof Error ? error.message : "Unknown scheduler error" })}\n`);
    } finally {
      if (await input.redis.get(lockKey) === token) await input.redis.del(lockKey);
      running = false;
    }
  };
  return {
    start() { void tick(); timer = setInterval(() => void tick(), 60_000); },
    async close() { if (timer) clearInterval(timer); await queue.close(); },
  };
}

async function refreshRanks(database: DatabaseClient, provider: NonNullable<ReturnType<typeof createSerpProvider>>): Promise<void> {
  const organizationRows = await database.db.select({ id: organizations.id }).from(organizations).limit(1000);
  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000);
  let remaining = 100;
  for (const organization of organizationRows) {
    if (remaining <= 0) break;
    const candidates = await withTenant(database.db, organization.id, (tx) => tx.select({ id: keywords.id, term: keywords.term, locale: keywords.locale, device: keywords.device, location: keywords.location, siteId: keywords.siteId, domain: sites.normalizedHost }).from(keywords).innerJoin(sites, eq(keywords.siteId, sites.id)).where(eq(keywords.active, true)).limit(Math.min(remaining, 500)));
    if (!candidates.length) continue;
    const recent = await withTenant(database.db, organization.id, (tx) => tx.select({ keywordId: rankObservations.keywordId }).from(rankObservations).where(and(inArray(rankObservations.keywordId, candidates.map((item) => item.id)), gte(rankObservations.capturedAt, cutoff))));
    const recentIds = new Set(recent.map((item) => item.keywordId));
    for (const candidate of candidates.filter((item) => !recentIds.has(item.id))) {
      if (remaining-- <= 0) break;
      try {
        const result = await provider.rank({ keyword: candidate.term, locale: candidate.locale, device: candidate.device, location: candidate.location, domain: candidate.domain });
        await withTenant(database.db, organization.id, async (tx) => {
          await tx.insert(rankObservations).values({ organizationId: organization.id, keywordId: candidate.id, position: result.position, resultUrl: result.url, serpFeatures: result.features, provider: "generic" });
          if (result.searchVolume !== undefined) await tx.update(keywords).set({ searchVolume: result.searchVolume, updatedAt: new Date() }).where(eq(keywords.id, candidate.id));
        });
      } catch (error) { process.stderr.write(`${JSON.stringify({ level: "warn", event: "serp.rank.failed", keywordId: candidate.id, error: error instanceof Error ? error.message : "SERP request failed" })}\n`); }
    }
  }
}
