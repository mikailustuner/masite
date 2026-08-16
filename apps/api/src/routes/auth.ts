import type { FastifyInstance } from "fastify";
import { loginRequestSchema, userSessionSchema } from "@evidera/contracts";
import { AppError } from "@evidera/runtime";
import type { ApiEnvironment } from "@evidera/runtime";
import type { AuthService } from "../services/authService.js";
import { requireRole } from "../plugins/auth.js";

export async function registerAuthRoutes(app: FastifyInstance, options: { authService: AuthService; environment: ApiEnvironment }): Promise<void> {
  const cookieOptions = {
    path: "/",
    httpOnly: true,
    secure: options.environment.COOKIE_SECURE,
    sameSite: "lax" as const,
  };

  app.post("/api/auth/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const input = loginRequestSchema.parse(request.body);
    const session = await options.authService.authenticate(input.email, input.password, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
    });
    reply.setCookie(options.environment.SESSION_COOKIE_NAME, session.token, {
      ...cookieOptions,
      expires: session.expiresAt,
    });
    return userSessionSchema.parse({
      user: { id: session.context.userId, email: session.context.email, displayName: session.context.displayName },
      organization: { id: session.context.organizationId, name: session.context.organizationName, slug: session.context.organizationSlug },
      role: session.context.role,
    });
  });

  app.get("/api/auth/session", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return userSessionSchema.parse({
      user: { id: auth.userId, email: auth.email, displayName: auth.displayName },
      organization: { id: auth.organizationId, name: auth.organizationName, slug: auth.organizationSlug },
      role: auth.role,
    });
  });

  app.post("/api/auth/logout", { preHandler: requireRole() }, async (request, reply) => {
    if (request.auth) await options.authService.revoke(request.auth.sessionId);
    reply.clearCookie(options.environment.SESSION_COOKIE_NAME, cookieOptions);
    return reply.code(204).send();
  });

  app.post<{ Body: { organizationId?: unknown } }>("/api/auth/switch-organization", { preHandler: requireRole() }, async (request) => {
    if (typeof request.body?.organizationId !== "string") throw new AppError("Geçerli çalışma alanı gerekli.", "INVALID_ORGANIZATION", 400);
    const auth = request.auth;
    if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const next = await options.authService.switchOrganization(auth, request.body.organizationId);
    return userSessionSchema.parse({
      user: { id: next.userId, email: next.email, displayName: next.displayName },
      organization: { id: next.organizationId, name: next.organizationName, slug: next.organizationSlug },
      role: next.role,
    });
  });
}
