import { describe, expect, it } from "vitest";
import { issues, sites } from "./mockData";

describe("portfolio fixture integrity", () => {
  it("uses unique site identifiers and valid scores", () => {
    expect(new Set(sites.map((site) => site.id)).size).toBe(sites.length);
    for (const site of sites) {
      expect(site.healthScore).toBeGreaterThanOrEqual(0);
      expect(site.healthScore).toBeLessThanOrEqual(100);
      expect(site.visibilityScore).toBeGreaterThanOrEqual(0);
      expect(site.visibilityScore).toBeLessThanOrEqual(100);
    }
  });

  it("links every issue to an existing site", () => {
    const siteIds = new Set(sites.map((site) => site.id));
    expect(issues.every((issue) => siteIds.has(issue.siteId))).toBe(true);
  });
});
