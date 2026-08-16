import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";
import { normalizePublicUrl, resolvePublicTarget } from "./urlSafety.js";

export interface FetchPolicy {
  userAgent: string;
  timeoutMs: number;
  maxResponseBytes: number;
  allowedPorts: readonly number[];
  maxRedirects?: number;
}

export interface SafeFetchResult {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  responseTimeMs: number;
  redirectChain: Array<{ from: string; to: string; statusCode: number }>;
}

export async function safeFetch(input: string, policy: FetchPolicy): Promise<SafeFetchResult> {
  const requested = normalizePublicUrl(input, policy.allowedPorts);
  const startedAt = performance.now();
  const redirectChain: SafeFetchResult["redirectChain"] = [];
  const maxRedirects = policy.maxRedirects ?? 5;
  let current = requested;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await requestOnce(current, policy);
    const locationValue = response.headers.location;
    const location = Array.isArray(locationValue) ? locationValue[0] : locationValue;
    if (response.statusCode >= 300 && response.statusCode < 400 && location) {
      if (redirectCount === maxRedirects) throw new Error("Redirect limit exceeded.");
      const next = normalizePublicUrl(new URL(location, current).toString(), policy.allowedPorts);
      redirectChain.push({ from: current.toString(), to: next.toString(), statusCode: response.statusCode });
      current = next;
      continue;
    }
    return { requestedUrl: requested.toString(), finalUrl: current.toString(), ...response, responseTimeMs: Math.round(performance.now() - startedAt), redirectChain };
  }
  throw new Error("Fetch did not complete.");
}

async function requestOnce(url: URL, policy: FetchPolicy): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const target = await resolvePublicTarget(url);
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = transport.request({
      protocol: url.protocol,
      hostname: target.address,
      family: target.family,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      servername: url.hostname,
      headers: { Host: url.host, Accept: "text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.8,*/*;q=0.1", "Accept-Encoding": "identity", "User-Agent": policy.userAgent },
      timeout: policy.timeoutMs,
    }, (response) => {
      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      response.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > policy.maxResponseBytes) {
          response.destroy(new Error("Response exceeded the configured size limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) });
      });
      response.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
    });
    request.on("timeout", () => request.destroy(new Error("Request timed out.")));
    request.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
    request.end();
  });
}
