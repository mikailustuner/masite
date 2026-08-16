import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { z } from "zod";

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

const booleanString = z.string().transform((value, context) => {
  if (value === "true") return true;
  if (value === "false") return false;
  context.addIssue({ code: "custom", message: "Expected true or false" });
  return z.NEVER;
});

const integerString = (minimum: number, maximum: number) => z.string().transform(Number).pipe(z.number().int().min(minimum).max(maximum));
const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional());

const baseEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().url().startsWith("postgres"),
  DATABASE_POOL_MAX: integerString(1, 100).default(10),
  REDIS_URL: z.string().url().startsWith("redis"),
  QUEUE_PREFIX: z.string().regex(/^[a-z0-9_-]+$/i).default("evidera"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(8),
  S3_FORCE_PATH_STYLE: booleanString.default(true),
  S3_SERVER_SIDE_ENCRYPTION: z.enum(["none", "AES256"]).default("none"),
});

export const apiEnvironmentSchema = baseEnvironmentSchema.extend({
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: integerString(1, 65535).default(4100),
  PUBLIC_APP_URL: z.string().url(),
  TRUST_PROXY: booleanString.default(false),
  SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default("evidera_session"),
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: integerString(1, 24 * 365).default(168),
  COOKIE_SECURE: booleanString.default(false),
});

export const workerEnvironmentSchema = baseEnvironmentSchema.extend({
  CRAWLER_USER_AGENT: z.string().min(10),
  CRAWLER_CONTACT_URL: z.string().url(),
  CRAWLER_TIMEOUT_MS: integerString(1000, 120_000).default(15_000),
  CRAWLER_MAX_RESPONSE_BYTES: integerString(1024, 20 * 1024 * 1024).default(2 * 1024 * 1024),
  CRAWLER_DEFAULT_DELAY_MS: integerString(100, 60_000).default(1000),
  CRAWLER_ALLOWED_PORTS: z.string().regex(/^\d+(,\d+)*$/).default("80,443").transform((value) => value.split(",").map(Number)),
  CHROMIUM_EXECUTABLE_PATH: z.string().min(1).default("/usr/bin/chromium"),
  RENDER_TIMEOUT_MS: integerString(1000, 120_000).default(30_000),
  CRUX_API_KEY: z.string().optional(),
  CRUX_API_BASE_URL: optionalUrl.default("https://chromeuxreport.googleapis.com/v1/records:queryRecord"),
  SERP_PROVIDER: z.enum(["disabled", "generic", "serper"]).default("disabled"),
  SERP_API_BASE_URL: optionalUrl,
  SERP_API_KEY: z.string().optional(),
  SERP_DAILY_QUERY_LIMIT: integerString(1, 1000).default(50),
  BACKLINK_PROVIDER: z.enum(["disabled", "generic"]).default("disabled"),
  BACKLINK_API_BASE_URL: optionalUrl,
  BACKLINK_API_KEY: z.string().optional(),
  OPENPAGERANK_API_BASE_URL: optionalUrl.default("https://openpagerank.keywordseverywhere.com/"),
  OPENPAGERANK_API_KEY: z.string().optional(),
  ALLOW_UNENCRYPTED_EVIDENCE: booleanString.default(false),
}).superRefine((value, context) => {
  if (value.SERP_PROVIDER === "generic" && (!value.SERP_API_BASE_URL || !value.SERP_API_KEY)) context.addIssue({ code: "custom", message: "SERP_API_BASE_URL and SERP_API_KEY are required for the generic SERP provider." });
  if (value.BACKLINK_PROVIDER === "generic" && (!value.BACKLINK_API_BASE_URL || !value.BACKLINK_API_KEY)) context.addIssue({ code: "custom", message: "BACKLINK_API_BASE_URL and BACKLINK_API_KEY are required for the generic backlink provider." });
  if (value.NODE_ENV === "production" && value.S3_SERVER_SIDE_ENCRYPTION === "none" && !value.ALLOW_UNENCRYPTED_EVIDENCE) context.addIssue({ code: "custom", message: "Production evidence storage requires encryption unless ALLOW_UNENCRYPTED_EVIDENCE is explicitly true." });
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

export function parseApiEnvironment(environment: NodeJS.ProcessEnv): ApiEnvironment {
  return apiEnvironmentSchema.parse(environment);
}

export function parseWorkerEnvironment(environment: NodeJS.ProcessEnv): WorkerEnvironment {
  return workerEnvironmentSchema.parse(environment);
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const AUDIT_QUEUE_NAME = "site-audits";
export const JOURNEY_QUEUE_NAME = "synthetic-journeys";

export function normalizeEmail(email: string): string {
  return email.trim().normalize("NFKC").toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 1024) throw new Error("Password must contain between 12 and 1024 characters.");
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `$scrypt$n=32768,r=8,p=1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 5 || parts[1] !== "scrypt" || parts[2] !== "n=32768,r=8,p=1") return false;
  const salt = Buffer.from(parts[3] ?? "", "base64url");
  const expected = Buffer.from(parts[4] ?? "", "base64url");
  if (salt.length !== 16 || expected.length !== 64) return false;
  const actual = await scrypt(password, salt, 64, { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(actual, expected);
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string, secret: string): string {
  return createHash("sha256").update(secret).update("\0").update(token).digest("hex");
}
