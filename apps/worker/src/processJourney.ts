import { and, eq } from "drizzle-orm";
import { chromium, type Browser } from "playwright-core";
import { normalizePublicUrl, resolvePublicTarget } from "@evidera/crawler";
import { journeyDefinitions, journeyRuns, sites, withTenant, type DatabaseClient } from "@evidera/database";
import type { WorkerEnvironment } from "@evidera/runtime";
import type { Job } from "bullmq";
import { z } from "zod";
import type { EvidenceStore } from "./services/evidenceStore.js";

const jobSchema = z.object({ runId: z.uuid(), journeyId: z.uuid(), organizationId: z.uuid(), siteId: z.uuid() });

export function createJourneyProcessor(input: { database: DatabaseClient; environment: WorkerEnvironment; evidenceStore: EvidenceStore }) {
  return async (job: Job): Promise<{ steps: number }> => {
    const data = jobSchema.parse(job.data);
    const definition = await withTenant(input.database.db, data.organizationId, async (tx) => {
      await tx.update(journeyRuns).set({ status: "running", startedAt: new Date(), errorMessage: null }).where(and(eq(journeyRuns.id, data.runId), eq(journeyRuns.organizationId, data.organizationId)));
      const journey = await tx.query.journeyDefinitions.findFirst({ where: and(eq(journeyDefinitions.id, data.journeyId), eq(journeyDefinitions.siteId, data.siteId)) });
      const site = await tx.query.sites.findFirst({ where: and(eq(sites.id, data.siteId), eq(sites.organizationId, data.organizationId)) });
      return journey && site ? { journey, site } : null;
    });
    if (!definition) throw new Error("Journey or site does not exist in the tenant.");
    const safeOrigin = normalizePublicUrl(definition.site.origin, input.environment.CRAWLER_ALLOWED_PORTS);
    const startUrl = normalizePublicUrl(definition.journey.startUrl, input.environment.CRAWLER_ALLOWED_PORTS);
    if (startUrl.origin !== safeOrigin.origin) throw new Error("Journey must start on the audited origin.");
    const target = await resolvePublicTarget(safeOrigin);
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ executablePath: input.environment.CHROMIUM_EXECUTABLE_PATH, headless: true, args: [`--host-resolver-rules=MAP ${safeOrigin.hostname} ${target.address}, EXCLUDE localhost`, "--no-sandbox", "--disable-background-networking", "--disable-sync", "--disable-default-apps"] });
      const viewport = definition.journey.device === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
      const context = await browser.newContext({ viewport, locale: definition.journey.locale, serviceWorkers: "block", userAgent: input.environment.CRAWLER_USER_AGENT });
      const page = await context.newPage();
      await page.route("**/*", async (route) => {
        try { const url = new URL(route.request().url()); return ["http:", "https:"].includes(url.protocol) && url.origin === safeOrigin.origin ? route.continue() : route.abort("blockedbyclient"); }
        catch { return route.abort("blockedbyclient"); }
      });
      const results: Array<Record<string, unknown>> = [];
      await page.goto(startUrl.toString(), { waitUntil: "domcontentloaded", timeout: input.environment.RENDER_TIMEOUT_MS });
      for (let index = 0; index < definition.journey.steps.length; index += 1) {
        const step = definition.journey.steps[index];
        if (!step) continue;
        const started = Date.now();
        if (step.action === "click") {
          if (!step.selector) throw new Error(`Step ${index + 1} requires a selector.`);
          const locator = page.locator(step.selector).first();
          const unsafe = await locator.evaluate((element) => {
            const input = element as HTMLInputElement;
            const tag = element.tagName.toLowerCase();
            const type = input.type?.toLowerCase();
            return tag === "button" && (!type || type === "submit") || tag === "input" && ["submit", "image"].includes(type);
          });
          if (unsafe) throw new Error(`Step ${index + 1} was blocked because form submission is never allowed.`);
          await locator.click({ timeout: input.environment.RENDER_TIMEOUT_MS, noWaitAfter: false });
        } else if (step.action === "fill") {
          if (!step.selector) throw new Error(`Step ${index + 1} requires a selector.`);
          const locator = page.locator(step.selector).first();
          const type = await locator.getAttribute("type");
          if (["password", "file", "hidden"].includes((type ?? "").toLowerCase())) throw new Error(`Step ${index + 1} targets a forbidden field type.`);
          await locator.fill(step.value ?? "", { timeout: input.environment.RENDER_TIMEOUT_MS });
        } else if (step.action === "assert_visible") {
          if (!step.selector) throw new Error(`Step ${index + 1} requires a selector.`);
          if (!await page.locator(step.selector).first().isVisible()) throw new Error(`Step ${index + 1} expected a visible element.`);
        } else if (step.action === "assert_url") {
          if (!step.value || !page.url().includes(step.value)) throw new Error(`Step ${index + 1} URL assertion failed.`);
        }
        const current = new URL(page.url());
        if (current.origin !== safeOrigin.origin) throw new Error(`Step ${index + 1} left the audited origin.`);
        const screenshot = await page.screenshot({ fullPage: true, type: "jpeg", quality: 70 });
        const artifact = await input.evidenceStore.putArtifact({ organizationId: data.organizationId, siteId: data.siteId, runId: data.runId, url: `${page.url()}#step-${index + 1}`, folder: "journey", extension: "jpg", contentType: "image/jpeg", body: Buffer.from(screenshot) });
        results.push({ step: index + 1, action: step.action, description: step.description, url: page.url(), durationMs: Date.now() - started, screenshotKey: artifact.key, capturedAt: new Date().toISOString() });
        await job.updateProgress(Math.round(((index + 1) / definition.journey.steps.length) * 100));
      }
      await context.close();
      await withTenant(input.database.db, data.organizationId, (tx) => tx.update(journeyRuns).set({ status: "completed", completedAt: new Date(), result: { steps: results, methodology: "same-origin, no-submit synthetic journey", device: definition.journey.device, locale: definition.journey.locale } }).where(eq(journeyRuns.id, data.runId)));
      return { steps: results.length };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Journey failed";
      await withTenant(input.database.db, data.organizationId, (tx) => tx.update(journeyRuns).set({ status: "failed", completedAt: new Date(), errorMessage: message }).where(eq(journeyRuns.id, data.runId)));
      throw error;
    } finally { await browser?.close(); }
  };
}
