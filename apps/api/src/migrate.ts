import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabaseClient } from "@evidera/database";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const database = createDatabaseClient(connectionString, 1);
const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? fileURLToPath(new URL("../../../infra/postgres/migrations", import.meta.url));
try {
  await migrate(database.db, { migrationsFolder });
  process.stdout.write("Database migrations completed.\n");
} finally { await database.close(); }
