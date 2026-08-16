import type { FastifyInstance } from "fastify";
import { AppError } from "@evidera/runtime";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function registerOriginProtection(
  app: FastifyInstance,
  options: { publicAppUrl: string; production: boolean },
): Promise<void> {
  const expectedOrigin = new URL(options.publicAppUrl).origin;
  app.addHook("onRequest", async (request) => {
    if (!unsafeMethods.has(request.method)) return;
    const origin = request.headers.origin;
    if (!origin && !options.production) return;
    if (origin !== expectedOrigin) throw new AppError("İstek kaynağı doğrulanamadı.", "ORIGIN_FORBIDDEN", 403);
  });
}
