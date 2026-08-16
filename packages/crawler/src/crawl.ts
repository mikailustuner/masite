import { createRequire } from "node:module";
import { XMLParser } from "fast-xml-parser";
import { analyzePage, type Observation } from "./analyzer.js";
import { safeFetch, type FetchPolicy, type SafeFetchResult } from "./fetch.js";
import { extractHtml, type ExtractedPage } from "./html.js";
import { normalizeCrawlUrl } from "./urlSafety.js";

interface RobotsRules {
  isAllowed(url: string, userAgent?: string): boolean | undefined;
  getSitemaps(): string[];
  getCrawlDelay(userAgent?: string): number | undefined;
}

const require = createRequire(import.meta.url);
const robotsParser = require("robots-parser") as (url: string, body: string) => RobotsRules;

export type CrawlMode = "quick" | "standard" | "deep";

export interface CrawledPage {
  url: string;
  depth: number;
  response: SafeFetchResult;
  extracted: ExtractedPage | null;
  observations: Observation[];
}

export interface CrawlResult {
  pages: number;
  discoveredUrls: number;
  blockedByRobots: number;
  robotsUrl: string;
  robotsBody: string | null;
  sitemapUrls: string[];
}

export interface CrawlOptions {
  origin: string;
  mode: CrawlMode;
  policy: FetchPolicy;
  delayMs: number;
  onPage: (page: CrawledPage) => Promise<void>;
}

const pageLimitByMode: Record<CrawlMode, number> = { quick: 1, standard: 100, deep: 500 };
const blockedExtensions = /\.(?:avi|bmp|css|csv|docx?|eot|exe|gif|ico|jpe?g|js|json|mov|mp3|mp4|pdf|png|pptx?|rar|rss|svg|tar|tiff?|ttf|txt|wav|webm|webp|woff2?|xlsx?|xml|zip)$/i;

export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
  const origin = new URL(options.origin).origin;
  const pageLimit = pageLimitByMode[options.mode];
  const robotsUrl = new URL("/robots.txt", origin).toString();
  let robotsBody: string | null = null;
  let robots = robotsParser(robotsUrl, "");
  const sitemapUrls = new Set<string>();

  try {
    const robotsResponse = await safeFetch(robotsUrl, options.policy);
    if (robotsResponse.statusCode === 200 && isTextResponse(robotsResponse)) {
      robotsBody = robotsResponse.body.toString("utf8");
      robots = robotsParser(robotsUrl, robotsBody);
      for (const sitemap of robots.getSitemaps()) sitemapUrls.add(sitemap);
    }
  } catch { /* A missing or temporarily unavailable robots file does not itself stop the audit. */ }

  sitemapUrls.add(new URL("/sitemap.xml", origin).toString());
  const sitemapPageUrls = options.mode === "quick" ? [] : await discoverSitemapUrls([...sitemapUrls], origin, options.policy);
  const declaredDelaySeconds = robots.getCrawlDelay(options.policy.userAgent);
  const effectiveDelayMs = Math.max(options.delayMs, typeof declaredDelaySeconds === "number" ? Math.min(60_000, Math.max(0, declaredDelaySeconds * 1000)) : 0);
  const queue: Array<{ url: string; depth: number }> = [{ url: origin, depth: 0 }];
  for (const url of sitemapPageUrls) queue.push({ url, depth: 1 });
  const queued = new Set(queue.map((entry) => normalizeCrawlUrl(entry.url).toString()));
  const visited = new Set<string>();
  let blockedByRobots = 0;

  while (queue.length > 0 && visited.size < pageLimit) {
    const entry = queue.shift();
    if (!entry) break;
    const normalized = normalizeCrawlUrl(entry.url);
    const normalizedUrl = normalized.toString();
    if (visited.has(normalizedUrl) || normalized.origin !== origin || blockedExtensions.test(normalized.pathname)) continue;
    if (robots.isAllowed(normalizedUrl, options.policy.userAgent) === false) {
      blockedByRobots += 1;
      visited.add(normalizedUrl);
      continue;
    }
    if (visited.size > 0 && effectiveDelayMs > 0) await delay(effectiveDelayMs);
    visited.add(normalizedUrl);
    let response: SafeFetchResult;
    let extracted: ExtractedPage | null;
    try {
      response = await safeFetch(normalizedUrl, options.policy);
      extracted = isHtmlResponse(response) ? extractHtml(response.body.toString("utf8"), response.finalUrl) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fetch failed";
      const synthetic: SafeFetchResult = { requestedUrl: normalizedUrl, finalUrl: normalizedUrl, statusCode: 0, headers: {}, body: Buffer.alloc(0), responseTimeMs: 0, redirectChain: [] };
      await options.onPage({
        url: normalizedUrl,
        depth: entry.depth,
        response: synthetic,
        extracted: null,
        observations: [{ ruleId: "fetch-failed", category: "http", title: "Sayfa isteği tamamlanamadı", severity: "high", confidence: "proven", summary: message, inference: "Bu çalışma ortamından erişim başarısız oldu; genel kesinti veya arama motoru erişim sorunu olduğu tek ölçümle çıkarılamaz.", impact: "Sayfanın dış istemciler tarafından erişilebilirliği doğrulanamadı.", recommendation: "DNS, TLS, WAF ve sunucu yanıtını kontrol edin.", verification: "Aynı ortamdan isteği yeniden çalıştırın.", evidenceLabel: "Fetch error", evidenceValue: message }],
      });
      continue;
    }
    const observations = extracted ? analyzePage(response, extracted) : [];
    await options.onPage({ url: normalizedUrl, depth: entry.depth, response, extracted, observations });
    if (!extracted) continue;
    for (const link of extracted.links) {
      try {
        const candidate = normalizeCrawlUrl(link);
        const candidateUrl = candidate.toString();
        if (candidate.origin === origin && !queued.has(candidateUrl) && !blockedExtensions.test(candidate.pathname)) {
          queued.add(candidateUrl);
          queue.push({ url: candidateUrl, depth: entry.depth + 1 });
        }
      } catch { /* Ignore invalid document links. */ }
    }
  }

  return { pages: visited.size - blockedByRobots, discoveredUrls: queued.size, blockedByRobots, robotsUrl, robotsBody, sitemapUrls: [...sitemapUrls] };
}

async function discoverSitemapUrls(seedSitemaps: string[], origin: string, policy: FetchPolicy): Promise<string[]> {
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const pending = [...seedSitemaps];
  const visited = new Set<string>();
  const pageUrls = new Set<string>();
  while (pending.length > 0 && visited.size < 10 && pageUrls.size < 10_000) {
    const sitemapUrl = pending.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);
    try {
      const response = await safeFetch(sitemapUrl, { ...policy, maxResponseBytes: Math.min(policy.maxResponseBytes * 5, 10 * 1024 * 1024) });
      if (response.statusCode !== 200) continue;
      const parsed = parser.parse(response.body.toString("utf8")) as Record<string, unknown>;
      const urlEntries = asArray((parsed.urlset as { url?: unknown } | undefined)?.url);
      for (const entry of urlEntries) {
        const location = valueLocation(entry);
        if (!location) continue;
        const url = normalizeCrawlUrl(location);
        if (url.origin === origin) pageUrls.add(url.toString());
      }
      const sitemapEntries = asArray((parsed.sitemapindex as { sitemap?: unknown } | undefined)?.sitemap);
      for (const entry of sitemapEntries) {
        const location = valueLocation(entry);
        if (location && new URL(location).origin === origin && !visited.has(location)) pending.push(location);
      }
    } catch { /* Invalid or inaccessible sitemap candidates are ignored; the HTML crawl remains available. */ }
  }
  return [...pageUrls];
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function valueLocation(value: unknown): string | null {
  if (typeof value === "object" && value !== null && "loc" in value && typeof value.loc === "string") return value.loc;
  return null;
}

function isHtmlResponse(response: SafeFetchResult): boolean {
  const value = response.headers["content-type"];
  const contentType = Array.isArray(value) ? value[0] : value;
  return Boolean(contentType?.toLowerCase().includes("text/html") || contentType?.toLowerCase().includes("application/xhtml+xml"));
}

function isTextResponse(response: SafeFetchResult): boolean {
  const value = response.headers["content-type"];
  const contentType = Array.isArray(value) ? value[0] : value;
  return Boolean(contentType?.toLowerCase().includes("text/") || contentType?.toLowerCase().includes("xml"));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
