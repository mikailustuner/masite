import { z } from "zod";
import type { WorkerEnvironment } from "@evidera/runtime";

const responseSchema = z.object({ position: z.number().positive().nullable(), url: z.string().url().nullable(), features: z.array(z.string()).default([]), searchVolume: z.number().int().nonnegative().nullable().optional() });

export function createSerpProvider(environment: WorkerEnvironment) {
  if (environment.SERP_PROVIDER === "disabled") return null;
  const baseUrl = environment.SERP_API_BASE_URL!;
  const apiKey = environment.SERP_API_KEY!;
  return {
    async rank(input: { keyword: string; locale: string; device: string; location: string; domain: string }) {
      const response = await fetch(new URL("rank", baseUrl), { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`SERP provider returned HTTP ${response.status}.`);
      return responseSchema.parse(await response.json());
    },
  };
}
