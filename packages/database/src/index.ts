import { sql as drizzleSql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseClient {
  db: Database;
  sql: Sql;
  close: () => Promise<void>;
}

export type TenantTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function withTenant<T>(
  database: Database,
  organizationId: string,
  operation: (transaction: TenantTransaction) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transaction) => {
    await transaction.execute(drizzleSql`select set_config('app.current_organization_id', ${organizationId}, true)`);
    return operation(transaction);
  });
}

export function createDatabaseClient(connectionString: string, maxConnections = 10): DatabaseClient {
  const sql = postgres(connectionString, {
    max: maxConnections,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => undefined,
  });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

export * from "./schema.js";
