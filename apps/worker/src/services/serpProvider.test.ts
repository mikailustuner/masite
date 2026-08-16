import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnvironment } from "@evidera/runtime";
import { createSerpProvider } from "./serpProvider.js";

afterEach(() => vi.unstubAllGlobals());

describe("Serper provider", () => {
  it("stays inactive until an API key is configured", () => {
    expect(createSerpProvider(environment({ SERP_API_KEY: undefined }))).toBeNull();
  });

  it("normalizes a Serper response into a domain rank observation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      knowledgeGraph: { title: "Example" },
      peopleAlsoAsk: [{ question: "Example?" }],
      organic: [
        { position: 1, link: "https://competitor.test/" },
        { position: 4, link: "https://www.example.com/landing" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = createSerpProvider(environment());
    const result = await provider!.rank({ keyword: "kanıtlı seo", locale: "tr-TR", device: "mobile", location: "Turkey", domain: "example.com" });

    expect(result).toEqual({ position: 4, url: "https://www.example.com/landing", features: ["knowledgeGraph", "peopleAlsoAsk"] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://google.serper.dev/search");
    expect(new Headers(init.headers).get("X-API-KEY")).toBe("serper-test-key");
    expect(JSON.parse(String(init.body))).toMatchObject({ q: "kanıtlı seo", hl: "tr", gl: "tr", location: "Turkey", device: "mobile", num: 100 });
  });
});

function environment(overrides: Partial<WorkerEnvironment> = {}): WorkerEnvironment {
  return {
    SERP_PROVIDER: "serper",
    SERP_API_BASE_URL: "https://google.serper.dev/",
    SERP_API_KEY: "serper-test-key",
    ...overrides,
  } as WorkerEnvironment;
}

