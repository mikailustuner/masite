import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";
import { normalizePublicUrl, resolvePublicTarget } from "./urlSafety.js";

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

export interface SafeFetchResult {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  responseTimeMs: number;
  redirectChain: Array<{ from: string; to: string; statusCode: number }>;
}

export async function safeFetchHtml(input: string): Promise<SafeFetchResult> {
  const requested = normalizePublicUrl(input);
  const startedAt = performance.now();
  const redirectChain: SafeFetchResult["redirectChain"] = [];
  let current = requested;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await requestOnce(current);
    const location = response.headers.location;
    const redirectLocation = Array.isArray(location) ? location[0] : location;

    if (response.statusCode >= 300 && response.statusCode < 400 && redirectLocation) {
      if (redirectCount === MAX_REDIRECTS) throw new Error("Yönlendirme limiti aşıldı.");
      const next = normalizePublicUrl(new URL(redirectLocation, current).toString());
      redirectChain.push({ from: current.toString(), to: next.toString(), statusCode: response.statusCode });
      current = next;
      continue;
    }

    return {
      requestedUrl: requested.toString(),
      finalUrl: current.toString(),
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
      responseTimeMs: Math.round(performance.now() - startedAt),
      redirectChain,
    };
  }

  throw new Error("Tarama tamamlanamadı.");
}

async function requestOnce(url: URL): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  const target = await resolvePublicTarget(url);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request({
      protocol: url.protocol,
      hostname: target.address,
      family: target.family,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      servername: url.hostname,
      headers: {
        Host: url.host,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.2",
        "Accept-Encoding": "identity",
        "User-Agent": "EvideraAuditBot/0.1 (+https://evidera.example/bot)",
      },
      timeout: TIMEOUT_MS,
    }, (response) => {
      const chunks: Buffer[] = [];
      let receivedBytes = 0;

      response.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_RESPONSE_BYTES) {
          response.destroy(new Error("Yanıt güvenli boyut limitini aşıyor."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
      response.on("error", reject);
    });

    request.on("timeout", () => request.destroy(new Error("İstek zaman aşımına uğradı.")));
    request.on("error", reject);
    request.end();
  });
}
