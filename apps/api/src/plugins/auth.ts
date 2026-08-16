import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "@evidera/runtime";
import type { AuthService } from "../services/authService.js";
import type { MembershipRole } from "../types.js";

const roleRank: Record<MembershipRole, number> = {
  client_viewer: 0,
  analyst: 1,
  consultant: 2,
  owner: 3,
};

export async function registerAuthentication(
  app: FastifyInstance,
  options: { authService: AuthService; cookieName: string },
): Promise<void> {
  app.decorateRequest("auth", null);
  app.addHook("onRequest", async (request) => {
    request.auth = await options.authService.resolve(request.cookies[options.cookieName]);
  });
}

export function requireRole(minimumRole: MembershipRole = "client_viewer") {
  return async function authorize(request: FastifyRequest): Promise<void> {
    if (!request.auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    if (roleRank[request.auth.role] < roleRank[minimumRole]) {
      throw new AppError("Bu işlem için yetkiniz yok.", "ROLE_FORBIDDEN", 403);
    }
  };
}
