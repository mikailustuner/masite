import type { membershipRole } from "@evidera/database";

export type MembershipRole = (typeof membershipRole.enumValues)[number];

export interface AuthContext {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: MembershipRole;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
