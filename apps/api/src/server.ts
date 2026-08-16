import { parseApiEnvironment } from "@evidera/runtime";
import { buildApp } from "./app.js";

const environment = parseApiEnvironment(process.env);
const { app, database } = await buildApp({ environment });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Graceful shutdown started");
  await app.close();
  await database.close();
  process.exit(0);
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

try {
  await app.listen({ port: environment.API_PORT, host: environment.API_HOST });
} catch (error) {
  app.log.fatal({ error }, "API startup failed");
  await database.close();
  process.exit(1);
}
