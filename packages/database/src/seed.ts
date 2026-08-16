import { eq } from "drizzle-orm";
import { hashPassword, normalizeEmail } from "@evidera/runtime";
import { createDatabaseClient, memberships, organizations, users } from "./index.js";

const connectionString = process.env.DATABASE_URL;
const emailInput = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const organizationName = process.env.BOOTSTRAP_ORGANIZATION_NAME;

if (!connectionString || !emailInput || !password || !organizationName) {
  throw new Error("DATABASE_URL and all BOOTSTRAP_* variables are required.");
}
if (password.startsWith("change-this")) throw new Error("Refusing to seed with the example bootstrap password.");

const email = normalizeEmail(emailInput);
const organizationSlug = organizationName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const passwordHash = await hashPassword(password);
const client = createDatabaseClient(connectionString, 1);

try {
  await client.db.transaction(async (transaction) => {
    const [organization] = await transaction.insert(organizations).values({ name: organizationName, slug: organizationSlug }).onConflictDoUpdate({ target: organizations.slug, set: { name: organizationName, updatedAt: new Date() } }).returning();
    if (!organization) throw new Error("Organization seed failed.");

    const existingUser = await transaction.query.users.findFirst({ where: eq(users.email, email) });
    const user = existingUser
      ? (await transaction.update(users).set({ displayName: email.split("@")[0] ?? "Admin", passwordHash, updatedAt: new Date() }).where(eq(users.id, existingUser.id)).returning())[0]
      : (await transaction.insert(users).values({ email, displayName: email.split("@")[0] ?? "Admin", passwordHash }).returning())[0];
    if (!user) throw new Error("User seed failed.");

    await transaction.insert(memberships).values({ organizationId: organization.id, userId: user.id, role: "owner" }).onConflictDoUpdate({ target: [memberships.organizationId, memberships.userId], set: { role: "owner" } });
  });
  process.stdout.write(`Bootstrap owner ${email} is ready.\n`);
} finally {
  await client.close();
}
