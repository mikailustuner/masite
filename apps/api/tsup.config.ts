import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/migrate.ts", "src/bootstrap.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: [/^@evidera\//],
});
