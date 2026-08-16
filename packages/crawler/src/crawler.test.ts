import { describe, expect, it } from "vitest";
import { analyzePage } from "./analyzer.js";
import { extractHtml } from "./html.js";
import { isBlockedIpAddress, normalizeCrawlUrl, normalizePublicUrl } from "./urlSafety.js";

describe("crawler primitives", () => {
  it.each(["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.1", "::1", "fc00::1", "fe80::1"])("blocks private IP %s", (address) => {
    expect(isBlockedIpAddress(address)).toBe(true);
  });

  it("denies IP literals and non-standard ports", () => {
    expect(() => normalizePublicUrl("https://127.0.0.1")).toThrow();
    expect(() => normalizePublicUrl("https://example.com:8443")).toThrow();
  });

  it("removes tracking parameters while preserving meaningful query values", () => {
    expect(normalizeCrawlUrl("https://example.com/products/?utm_source=x&page=2#top").toString()).toBe("https://example.com/products?page=2");
  });

  it("parses HTML5 attributes independent of source ordering", () => {
    const extracted = extractHtml('<!doctype html><html lang="tr"><head><meta content="Açıklama" name="description"><title>Örnek</title><link href="https://example.com/" rel="canonical"></head><body><h1>Ana başlık</h1><a href="/iki">İki</a></body></html>', "https://example.com/");
    expect(extracted.description).toBe("Açıklama");
    expect(extracted.canonicalUrls).toEqual(["https://example.com/"]);
    expect(extracted.links).toEqual(["https://example.com/iki"]);
  });

  it("labels a missing description as a contextual observation", () => {
    const extracted = extractHtml('<html lang="tr"><head><title>Örnek</title></head><body><h1>Başlık</h1></body></html>', "https://example.com/");
    const observations = analyzePage({ requestedUrl: "https://example.com/", finalUrl: "https://example.com/", statusCode: 200, headers: { "content-type": "text/html" }, body: Buffer.alloc(0), responseTimeMs: 10, redirectChain: [] }, extracted);
    expect(observations.find((item) => item.ruleId === "missing-description")?.impact).toContain("doğrudan sıralama cezası değildir");
  });
});
