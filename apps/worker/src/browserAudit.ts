import axe from "axe-core";
import { chromium, type Browser } from "playwright-core";
import { normalizePublicUrl, resolvePublicTarget, type Observation } from "@evidera/crawler";
import type { WorkerEnvironment } from "@evidera/runtime";

export interface BrowserAuditResult {
  observations: Observation[];
  screenshot: Buffer;
  metrics: { domContentLoadedMs: number | null; loadMs: number | null; transferBytes: number | null; axeViolations: number };
}

interface AxeViolation { id: string; impact: string | null; description: string; help: string; helpUrl: string; nodes: unknown[] }
interface AxeWindow { axe: { run: (options?: unknown) => Promise<{ violations: AxeViolation[] }> } }

export async function createBrowserAuditor(origin: string, environment: WorkerEnvironment) {
  const safeOrigin = normalizePublicUrl(origin, environment.CRAWLER_ALLOWED_PORTS);
  const target = await resolvePublicTarget(safeOrigin);
  const browser: Browser = await chromium.launch({
    executablePath: environment.CHROMIUM_EXECUTABLE_PATH,
    headless: true,
    args: [`--host-resolver-rules=MAP ${safeOrigin.hostname} ${target.address}, EXCLUDE localhost`, "--no-sandbox", "--disable-background-networking", "--disable-sync", "--disable-default-apps"],
  });
  return {
    async audit(url: string): Promise<BrowserAuditResult> {
      const candidate = normalizePublicUrl(url, environment.CRAWLER_ALLOWED_PORTS);
      if (candidate.origin !== safeOrigin.origin) throw new Error("Rendered navigation left the audited origin.");
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", serviceWorkers: "block", userAgent: environment.CRAWLER_USER_AGENT });
      const page = await context.newPage();
      await page.route("**/*", async (route) => {
        try {
          const requestUrl = new URL(route.request().url());
          if (!['http:', 'https:'].includes(requestUrl.protocol) || requestUrl.origin !== safeOrigin.origin) return route.abort("blockedbyclient");
          return route.continue();
        } catch { return route.abort("blockedbyclient"); }
      });
      try {
        await page.goto(candidate.toString(), { waitUntil: "networkidle", timeout: environment.RENDER_TIMEOUT_MS });
        await page.addScriptTag({ content: axe.source });
        const axeResult = await page.evaluate(async () => (globalThis as unknown as AxeWindow).axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
        const timing = await page.evaluate(() => {
          const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
          return navigation ? { domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd), loadMs: Math.round(navigation.loadEventEnd), transferBytes: navigation.transferSize } : { domContentLoadedMs: null, loadMs: null, transferBytes: null };
        });
        const screenshot = await page.screenshot({ fullPage: true, type: "jpeg", quality: 72 });
        const observations: Observation[] = axeResult.violations.map((violation) => ({
          ruleId: `axe-${violation.id}`, category: "accessibility", title: violation.help,
          severity: violation.impact === "critical" ? "critical" : violation.impact === "serious" ? "high" : violation.impact === "moderate" ? "medium" : "low",
          confidence: "proven", summary: `${violation.nodes.length} DOM örneğinde axe kural ihlali gözlendi. ${violation.description}`, inference: "Otomatik axe sonucu kanıtlandı; gerçek yardımcı teknoloji deneyiminin tamamı ve hukuki uyumluluk yalnızca otomasyonla belirlenemez.",
          impact: "WCAG uyumluluğu ve yardımcı teknoloji kullanımı etkilenebilir.", recommendation: `axe kuralını uygulayın ve manuel klavye/ekran okuyucu testiyle doğrulayın: ${violation.helpUrl}`,
          verification: "Aynı URL’yi axe ve manuel erişilebilirlik kontrolüyle yeniden test edin.", evidenceLabel: `axe:${violation.id}`, evidenceValue: JSON.stringify({ impact: violation.impact, nodes: violation.nodes.slice(0, 5) }),
        }));
        return { observations, screenshot: Buffer.from(screenshot), metrics: { ...timing, axeViolations: axeResult.violations.length } };
      } finally { await context.close(); }
    },
    close: () => browser.close(),
  };
}
