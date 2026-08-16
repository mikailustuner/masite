import { z } from "zod";
import type { WorkerEnvironment } from "@evidera/runtime";

const responseSchema = z.object({ position: z.number().positive().nullable(), url: z.string().url().nullable(), features: z.array(z.string()).default([]), searchVolume: z.number().int().nonnegative().nullable().optional() });
const serperResponseSchema = z.object({
  organic: z.array(z.object({ position: z.number().int().positive(), link: z.string().url() })).default([]),
  knowledgeGraph: z.unknown().optional(), answerBox: z.unknown().optional(), peopleAlsoAsk: z.unknown().optional(),
  places: z.unknown().optional(), local: z.unknown().optional(), shopping: z.unknown().optional(),
  videos: z.unknown().optional(), news: z.unknown().optional(), images: z.unknown().optional(),
});

export type SerpProvider = {
  name: "generic" | "serper";
  rank(input: { keyword: string; locale: string; device: string; location: string; domain: string }): Promise<z.infer<typeof responseSchema>>;
};

export function createSerpProvider(environment: WorkerEnvironment): SerpProvider | null {
  if (environment.SERP_PROVIDER === "disabled" || (environment.SERP_PROVIDER === "serper" && !environment.SERP_API_KEY)) return null;
  const baseUrl = environment.SERP_API_BASE_URL!;
  const apiKey = environment.SERP_API_KEY!;
  if (environment.SERP_PROVIDER === "serper") return {
    name: "serper",
    async rank(input) {
      const [language, region] = input.locale.replace("_", "-").split("-");
      const response = await fetch(new URL("search", baseUrl), {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ q: input.keyword, hl: language?.toLowerCase() || "en", ...(region ? { gl: region.toLowerCase() } : {}), ...(input.location ? { location: input.location } : {}), device: input.device === "mobile" ? "mobile" : "desktop", num: 100 }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Serper returned HTTP ${response.status}.`);
      const payload = serperResponseSchema.parse(await response.json());
      const target = normalizeHostname(input.domain);
      const match = payload.organic.find((item) => {
        const hostname = normalizeHostname(new URL(item.link).hostname);
        return hostname === target || hostname.endsWith(`.${target}`);
      });
      const featureKeys = ["knowledgeGraph", "answerBox", "peopleAlsoAsk", "places", "local", "shopping", "videos", "news", "images"] as const;
      return responseSchema.parse({ position: match?.position ?? null, url: match?.link ?? null, features: featureKeys.filter((key) => payload[key] !== undefined) });
    },
  };
  return {
    name: "generic",
    async rank(input: { keyword: string; locale: string; device: string; location: string; domain: string }) {
      const response = await fetch(new URL("rank", baseUrl), { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`SERP provider returned HTTP ${response.status}.`);
      return responseSchema.parse(await response.json());
    },
  };
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]!.replace(/^www\./, "").replace(/\.$/, "");
}
