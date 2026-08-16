import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "../../infra/postgres/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://evidera:evidera_dev_password@127.0.0.1:5432/evidera",
  },
  strict: true,
  verbose: true,
});
