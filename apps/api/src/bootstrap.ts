import { eq } from "drizzle-orm";
import { createDatabaseClient, memberships, organizations, users } from "@evidera/database";
import { hashPassword, normalizeEmail } from "@evidera/runtime";

const connectionString = process.env.DATABASE_URL;
const emailInput = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const organizationName = process.env.BOOTSTRAP_ORGANIZATION_NAME;
if (!connectionString || !emailInput || !password || !organizationName) throw new Error("DATABASE_URL and all BOOTSTRAP_* variables are required.");
if (password.length < 16) throw new Error("Bootstrap password must contain at least 16 characters.");

const email = normalizeEmail(emailInput);
const organizationSlug = organizationName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const passwordHash = await hashPassword(password);
const database = createDatabaseClient(connectionString, 1);
try {
  await database.db.transaction(async (tx) => {
    const [organization] = await tx.insert(organizations).values({ name: organizationName, slug: organizationSlug }).onConflictDoUpdate({ target: organizations.slug, set: { name: organizationName, updatedAt: new Date() } }).returning();
    if (!organization) throw new Error("Organization bootstrap failed.");
    const existing = await tx.query.users.findFirst({ where: eq(users.email, email) });
    const [user] = existing
      ? await tx.update(users).set({ displayName: existing.displayName || "Admin", passwordHash, disabledAt: null, updatedAt: new Date() }).where(eq(users.id, existing.id)).returning()
      : await tx.insert(users).values({ email, displayName: "Evidera Admin", passwordHash }).returning();
    if (!user) throw new Error("Owner bootstrap failed.");
    await tx.insert(memberships).values({ organizationId: organization.id, userId: user.id, role: "owner" }).onConflictDoUpdate({ target: [memberships.organizationId, memberships.userId], set: { role: "owner" } });
  });
  process.stdout.write(`Bootstrap owner ${email} is ready.\n`);
} finally { await database.close(); }
