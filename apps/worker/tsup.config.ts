import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/worker.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: [/^@evidera\//],
  external: ["@aws-sdk/client-s3", "axe-core", "bullmq", "cheerio", "drizzle-orm", "fast-xml-parser", "ioredis", "playwright-core", "postgres", "robots-parser", "zod"],
});
