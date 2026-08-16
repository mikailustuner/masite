import { createHash } from "node:crypto";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { crawlSite, type Observation } from "@evidera/crawler";
import {
  auditRuns,
  evidence,
  intelligenceItems,
  issues,
  pages,
  pageSnapshots,
  siteEvents,
  sites,
  withTenant,
  type DatabaseClient,
} from "@evidera/database";
import type { WorkerEnvironment } from "@evidera/runtime";
import { z } from "zod";
import type { Job } from "bullmq";
import type { EvidenceStore } from "./services/evidenceStore.js";
import { createBrowserAuditor } from "./browserAudit.js";
import { buildPageEvents, buildPageIntelligence } from "./intelligenceEngine.js";
import { collectExternalIntelligence } from "./services/externalIntelligence.js";

const auditJobSchema = z.object({
  runId: z.uuid(),
  organizationId: z.uuid(),
  siteId: z.uuid(),
  mode: z.enum(["quick", "standard", "deep"]),
});

interface AggregatedObservation {
  observation: Observation;
  count: number;
  samples: Array<{ snapshotId: string; url: string; screenshotKey: string | null }>;
}

export function createAuditProcessor(input: { database: DatabaseClient; environment: WorkerEnvironment; evidenceStore: EvidenceStore }) {
  return async function processAudit(job: Job): Promise<{ pages: number; issues: number }> {
    const data = auditJobSchema.parse(job.data);
    const { database, environment, evidenceStore } = input;
    const site = await withTenant(database.db, data.organizationId, async (transaction) => {
      await transaction.update(auditRuns).set({ status: "running", startedAt: new Date(), errorCode: null, errorMessage: null }).where(and(eq(auditRuns.id, data.runId), eq(auditRuns.organizationId, data.organizationId)));
      return transaction.query.sites.findFirst({ where: and(eq(sites.id, data.siteId), eq(sites.organizationId, data.organizationId)) });
    });
    if (!site) throw new Error("Audit site does not exist in the tenant.");

    const aggregated = new Map<string, AggregatedObservation>();
    let crawledPages = 0;
    let renderedPages = 0;
    const performanceScores: number[] = [];
    const accessibilityScores: number[] = [];
    const renderLimit = data.mode === "standard" ? 5 : data.mode === "deep" ? 20 : 0;
    let browserAuditor: Awaited<ReturnType<typeof createBrowserAuditor>> | null = null;
    try {
      browserAuditor = renderLimit > 0 ? await createBrowserAuditor(site.origin, environment) : null;
      const externalIntelligencePromise = collectExternalIntelligence(site.origin, environment).catch((error) => { process.stderr.write(`${JSON.stringify({ level: "warn", event: "external-intelligence.failed", siteId: site.id, error: error instanceof Error ? error.message : "External intelligence failed" })}\n`); return []; });
      const crawlResult = await crawlSite({
        origin: site.origin,
        mode: data.mode,
        delayMs: environment.CRAWLER_DEFAULT_DELAY_MS,
        policy: {
          userAgent: environment.CRAWLER_USER_AGENT,
          timeoutMs: environment.CRAWLER_TIMEOUT_MS,
          maxResponseBytes: environment.CRAWLER_MAX_RESPONSE_BYTES,
          allowedPorts: environment.CRAWLER_ALLOWED_PORTS,
        },
        onPage: async (page) => {
          crawledPages += 1;
          let browserResult: Awaited<ReturnType<NonNullable<typeof browserAuditor>["audit"]>> | null = null;
          if (browserAuditor && page.extracted && renderedPages < renderLimit) {
            try {
              browserResult = await browserAuditor.audit(page.url); renderedPages += 1;
              const loadMs = browserResult.metrics.loadMs;
              if (loadMs !== null) performanceScores.push(loadMs <= 1000 ? 95 : loadMs <= 2000 ? 80 : loadMs <= 4000 ? 55 : 30);
              accessibilityScores.push(Math.max(0, 100 - browserResult.observations.reduce((penalty, observation) => penalty + (observation.severity === "critical" ? 20 : observation.severity === "high" ? 12 : observation.severity === "medium" ? 6 : 2), 0)));
            } catch (error) { process.stderr.write(`${JSON.stringify({ level: "warn", event: "render.failed", url: page.url, error: error instanceof Error ? error.message : "Render failed" })}\n`); }
          }
          const screenshotArtifact = browserResult ? await evidenceStore.putArtifact({ organizationId: data.organizationId, siteId: data.siteId, runId: data.runId, url: page.url, folder: "screenshots", extension: "jpg", contentType: "image/jpeg", body: browserResult.screenshot }) : null;
          const artifact = page.response.body.length > 0 && page.extracted
            ? await evidenceStore.putHtml({ organizationId: data.organizationId, siteId: data.siteId, runId: data.runId, url: page.url, body: page.response.body })
            : null;
          const snapshotBundle = await withTenant(database.db, data.organizationId, async (transaction) => {
            const [pageRow] = await transaction.insert(pages).values({
              organizationId: data.organizationId,
              siteId: data.siteId,
              normalizedUrl: page.url,
              path: new URL(page.url).pathname,
              lastSeenAt: new Date(),
            }).onConflictDoUpdate({ target: [pages.siteId, pages.normalizedUrl], set: { lastSeenAt: new Date() } }).returning();
            if (!pageRow) throw new Error("Page upsert failed.");
            const previousSnapshot = await transaction.query.pageSnapshots.findFirst({ where: eq(pageSnapshots.pageId, pageRow.id), orderBy: [desc(pageSnapshots.capturedAt)] });
            const [snapshotRow] = await transaction.insert(pageSnapshots).values({
              organizationId: data.organizationId,
              siteId: data.siteId,
              pageId: pageRow.id,
              auditRunId: data.runId,
              statusCode: page.response.statusCode,
              responseTimeMs: page.response.responseTimeMs,
              contentType: headerValue(page.response.headers["content-type"]),
              contentBytes: artifact?.originalBytes ?? page.response.body.length,
              artifactKey: artifact?.key,
              artifactSha256: artifact?.sha256,
              extracted: page.extracted ? { ...page.extracted, browserMetrics: browserResult ? { ...browserResult.metrics, device: "desktop", viewport: "1440x1000", locale: "tr-TR", source: "playwright+axe" } : null, screenshotKey: screenshotArtifact?.key ?? null } : {},
            }).returning();
            return { snapshotRow, pageRow, previousSnapshot };
          });
          const snapshot = snapshotBundle.snapshotRow;
          if (!snapshot) throw new Error("Snapshot insert failed.");
          const pageEvents = buildPageEvents({ url: page.url, statusCode: page.response.statusCode, extracted: page.extracted, previous: snapshotBundle.previousSnapshot ? { statusCode: snapshotBundle.previousSnapshot.statusCode, extracted: snapshotBundle.previousSnapshot.extracted } : null });
          const intelligence = page.extracted ? buildPageIntelligence({ url: page.url, extracted: page.extracted, responseBytes: page.response.body.length, responseTimeMs: page.response.responseTimeMs }) : [];
          await withTenant(database.db, data.organizationId, async (transaction) => {
            if (pageEvents.length) await transaction.insert(siteEvents).values(pageEvents.map((item) => ({ ...item, organizationId: data.organizationId, siteId: data.siteId, auditRunId: data.runId, pageId: snapshotBundle.pageRow.id })));
            for (const item of intelligence) await transaction.insert(intelligenceItems).values({ ...item, organizationId: data.organizationId, siteId: data.siteId, auditRunId: data.runId }).onConflictDoUpdate({ target: [intelligenceItems.siteId, intelligenceItems.fingerprint], set: { status: "active", priority: item.priority, confidence: item.confidence, title: item.title, observation: item.observation, evidenceSummary: item.evidenceSummary, inference: item.inference, impact: item.impact, recommendation: item.recommendation, verification: item.verification, source: item.source, methodology: item.methodology, measurement: item.measurement, lastSeenAt: new Date(), updatedAt: new Date(), auditRunId: data.runId } });
          });
          for (const observation of [...page.observations, ...(browserResult?.observations ?? [])]) {
            const current = aggregated.get(observation.ruleId) ?? { observation, count: 0, samples: [] };
            current.count += 1;
            if (current.samples.length < 5) current.samples.push({ snapshotId: snapshot.id, url: page.url, screenshotKey: screenshotArtifact?.key ?? null });
            aggregated.set(observation.ruleId, current);
          }
          await withTenant(database.db, data.organizationId, (transaction) => transaction.update(auditRuns).set({
            discoveredUrls: crawledPages,
            renderedUrls: renderedPages,
            issuesCreated: aggregated.size,
            summary: { stage: "crawling", processedUrls: crawledPages, renderLimit },
          }).where(and(eq(auditRuns.id, data.runId), eq(auditRuns.organizationId, data.organizationId))));
          await job.updateProgress(Math.min(95, Math.max(1, crawledPages)));
        },
      });

      await withTenant(database.db, data.organizationId, (transaction) => transaction.update(auditRuns).set({
        discoveredUrls: crawlResult.discoveredUrls,
        renderedUrls: renderedPages,
        issuesCreated: aggregated.size,
        summary: { stage: "external-intelligence", processedUrls: crawlResult.pages, renderLimit },
      }).where(and(eq(auditRuns.id, data.runId), eq(auditRuns.organizationId, data.organizationId))));
      const externalIntelligence = await externalIntelligencePromise;
      await withTenant(database.db, data.organizationId, async (transaction) => {
        for (const item of externalIntelligence) await transaction.insert(intelligenceItems).values({ ...item, organizationId: data.organizationId, siteId: data.siteId, auditRunId: data.runId }).onConflictDoUpdate({ target: [intelligenceItems.siteId, intelligenceItems.fingerprint], set: { status: "active", priority: item.priority, confidence: item.confidence, title: item.title, observation: item.observation, evidenceSummary: item.evidenceSummary, inference: item.inference, impact: item.impact, recommendation: item.recommendation, verification: item.verification, source: item.source, methodology: item.methodology, measurement: item.measurement, lastSeenAt: new Date(), updatedAt: new Date(), auditRunId: data.runId } });
      });

      const observedIssueIds: string[] = [];
      await withTenant(database.db, data.organizationId, (transaction) => transaction.update(auditRuns).set({
        issuesCreated: aggregated.size,
        summary: { stage: "findings", processedUrls: crawlResult.pages, renderLimit },
      }).where(and(eq(auditRuns.id, data.runId), eq(auditRuns.organizationId, data.organizationId))));
      for (const [ruleId, item] of aggregated) {
        const fingerprint = createHash("sha256").update(`${site.id}:${ruleId}`).digest("hex");
        const issue = await withTenant(database.db, data.organizationId, async (transaction) => {
          const [row] = await transaction.insert(issues).values({
            organizationId: data.organizationId,
            siteId: data.siteId,
            ruleId,
            fingerprint,
            title: item.observation.title,
            category: item.observation.category,
            severity: item.observation.severity,
            confidence: item.observation.confidence,
            summary: item.observation.summary,
            inference: item.observation.inference,
            impact: item.observation.impact,
            recommendation: item.observation.recommendation,
            verification: item.observation.verification,
            affectedUrlCount: item.count,
          }).onConflictDoUpdate({
            target: [issues.siteId, issues.fingerprint],
            set: {
              title: item.observation.title,
              severity: item.observation.severity,
              confidence: item.observation.confidence,
              summary: item.observation.summary,
              inference: item.observation.inference,
              impact: item.observation.impact,
              recommendation: item.observation.recommendation,
              verification: item.observation.verification,
              affectedUrlCount: item.count,
              lastSeenAt: new Date(),
              updatedAt: new Date(),
              state: sql`case when ${issues.state} = 'resolved' then 'regressed'::issue_state else ${issues.state} end`,
              resolvedAt: null,
            },
          }).returning();
          return row;
        });
        if (!issue) continue;
        observedIssueIds.push(issue.id);
        await withTenant(database.db, data.organizationId, async (transaction) => {
          await transaction.delete(evidence).where(and(eq(evidence.issueId, issue.id), inArray(evidence.snapshotId, item.samples.map((sample) => sample.snapshotId))));
          if (item.samples.length > 0) await transaction.insert(evidence).values(item.samples.flatMap((sample) => {
            const primary = {
              organizationId: data.organizationId,
              siteId: data.siteId,
              issueId: issue.id,
              snapshotId: sample.snapshotId,
              kind: item.observation.ruleId.startsWith("axe-") ? "dom" as const : "html" as const,
              label: item.observation.evidenceLabel,
              value: item.observation.evidenceValue,
              sourceUrl: sample.url,
              artifactKey: null,
            };
            return sample.screenshotKey ? [primary, {
              ...primary,
              kind: "screenshot" as const,
              label: "Render ekran görüntüsü",
              value: "Bulgunun ölçüldüğü render anındaki masaüstü görünümü.",
              artifactKey: sample.screenshotKey,
            }] : [primary];
          }));
        });
      }

      await withTenant(database.db, data.organizationId, async (transaction) => {
        const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
        const latestScores = { performance: average(performanceScores), accessibility: average(accessibilityScores), methodology: "Evidera lab heuristic; not Lighthouse or field data", measuredPages: renderedPages };
        if (data.mode === "deep" && crawlResult.pages > 0) {
          await transaction.update(issues).set({ state: "resolved", resolvedAt: new Date(), updatedAt: new Date() }).where(and(eq(issues.siteId, data.siteId), sql`${issues.state} not in ('accepted_risk', 'false_positive')`, ...(observedIssueIds.length > 0 ? [notInArray(issues.id, observedIssueIds)] : [])));
        }
        await transaction.update(auditRuns).set({
          status: "completed",
          completedAt: new Date(),
          discoveredUrls: crawlResult.discoveredUrls,
          renderedUrls: renderedPages,
          issuesCreated: aggregated.size,
          summary: { pages: crawlResult.pages, blockedByRobots: crawlResult.blockedByRobots, robotsUrl: crawlResult.robotsUrl, sitemaps: crawlResult.sitemapUrls, latestScores, renderPolicy: "same-origin resources only; third-party assets are blocked" },
        }).where(eq(auditRuns.id, data.runId));
        await transaction.update(sites).set({ lastAuditAt: new Date(), updatedAt: new Date(), settings: { ...site.settings, latestScores } }).where(eq(sites.id, data.siteId));
      });
      await job.updateProgress(100);
      await browserAuditor?.close();
      browserAuditor = null;
      return { pages: crawlResult.pages, issues: aggregated.size };
    } catch (error) {
      await browserAuditor?.close().catch(() => undefined);
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Audit worker failed";
      await withTenant(database.db, data.organizationId, (transaction) => transaction.update(auditRuns).set({ status: "failed", completedAt: new Date(), errorCode: "WORKER_FAILED", errorMessage: message }).where(eq(auditRuns.id, data.runId)));
      throw error;
    }
  };
}

function headerValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
