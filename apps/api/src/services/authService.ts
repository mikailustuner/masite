import { and, eq, gt, isNull, lt } from "drizzle-orm";
import {
  memberships,
  organizations,
  sessions,
  users,
  type DatabaseClient,
} from "@evidera/database";
import {
  AppError,
  createOpaqueToken,
  hashPassword,
  hashToken,
  normalizeEmail,
  verifyPassword,
} from "@evidera/runtime";
import type { AuthContext } from "../types.js";

interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
  context: AuthContext;
}

export function createAuthService(database: DatabaseClient, secret: string, ttlHours: number) {
  const dummyHash = hashPassword("constant-time-placeholder-password");

  async function authenticate(emailInput: string, password: string, metadata: SessionMetadata): Promise<CreatedSession> {
    const email = normalizeEmail(emailInput);
    const user = await database.db.query.users.findFirst({ where: and(eq(users.email, email), isNull(users.disabledAt)) });
    const passwordMatches = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
    if (!user || !passwordMatches) throw new AppError("E-posta veya parola hatalı.", "INVALID_CREDENTIALS", 401);

    const membershipRows = await database.db
      .select({
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, user.id))
      .limit(1);
    const membership = membershipRows[0];
    if (!membership) throw new AppError("Kullanıcının etkin bir çalışma alanı yok.", "NO_ORGANIZATION", 403);

    const token = createOpaqueToken();
    const tokenHash = hashToken(token, secret);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const [session] = await database.db.insert(sessions).values({
      userId: user.id,
      activeOrganizationId: membership.organizationId,
      tokenHash,
      userAgent: metadata.userAgent?.slice(0, 500),
      ipHash: metadata.ipAddress ? hashToken(metadata.ipAddress, secret) : null,
      expiresAt,
    }).returning({ id: sessions.id });
    if (!session) throw new AppError("Oturum oluşturulamadı.", "SESSION_CREATE_FAILED", 500);
    await database.db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));

    return {
      token,
      expiresAt,
      context: {
        sessionId: session.id,
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        organizationId: membership.organizationId,
        organizationName: membership.organizationName,
        organizationSlug: membership.organizationSlug,
        role: membership.role,
      },
    };
  }

  async function resolve(token: string | undefined): Promise<AuthContext | null> {
    if (!token || token.length > 256) return null;
    const tokenHash = hashToken(token, secret);
    const rows = await database.db
      .select({
        sessionId: sessions.id,
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        role: memberships.role,
        lastSeenAt: sessions.lastSeenAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .innerJoin(organizations, eq(sessions.activeOrganizationId, organizations.id))
      .innerJoin(memberships, and(eq(memberships.userId, users.id), eq(memberships.organizationId, organizations.id)))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date()), isNull(users.disabledAt)))
      .limit(1);
    const context = rows[0];
    if (!context) return null;
    if (context.lastSeenAt < new Date(Date.now() - 15 * 60 * 1000)) {
      await database.db.update(sessions).set({ lastSeenAt: new Date() }).where(and(eq(sessions.id, context.sessionId), lt(sessions.lastSeenAt, new Date(Date.now() - 15 * 60 * 1000))));
    }
    return context;
  }

  async function revoke(sessionId: string): Promise<void> {
    await database.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async function switchOrganization(context: AuthContext, organizationId: string): Promise<AuthContext> {
    const rows = await database.db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: memberships.role })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
      .where(and(eq(memberships.userId, context.userId), eq(memberships.organizationId, organizationId)))
      .limit(1);
    const target = rows[0];
    if (!target) throw new AppError("Bu çalışma alanına erişim yok.", "ORGANIZATION_FORBIDDEN", 403);
    await database.db.update(sessions).set({ activeOrganizationId: target.id }).where(eq(sessions.id, context.sessionId));
    return { ...context, organizationId: target.id, organizationName: target.name, organizationSlug: target.slug, role: target.role };
  }

  return { authenticate, resolve, revoke, switchOrganization };
}

export type AuthService = ReturnType<typeof createAuthService>;
