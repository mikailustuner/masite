import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabaseClient } from "./index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for migrations.");

const client = createDatabaseClient(connectionString, 1);
const migrationsFolder = fileURLToPath(new URL("../../../infra/postgres/migrations", import.meta.url));

try {
  await migrate(client.db, { migrationsFolder });
  process.stdout.write("Database migrations completed.\n");
} finally {
  await client.close();
}
