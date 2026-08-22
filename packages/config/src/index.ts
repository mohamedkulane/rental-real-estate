import { z } from 'zod';

const nodeEnvironment = z.enum(['development', 'test', 'production']).default('development');
const hexKey = z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be a 32-byte hexadecimal key');

export const apiEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironment,
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3001),
  WEB_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  AUTH_LOGIN_LIMIT_PER_15_MINUTES: z.coerce.number().int().min(3).max(100).default(10),
  AUTH_RESET_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(50).default(5),
  SESSION_ACTIVITY_WRITE_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(60).default(5),
  EXPOSE_API_DOCS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  EXPOSE_DEVELOPMENT_RESET_TOKEN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  PARTY_DATA_ENCRYPTION_KEY: hexKey,
  PARTY_DATA_ENCRYPTION_KEY_VERSION: z
    .string()
    .regex(/^v[1-9][0-9]*$/)
    .default('v1'),
  PARTY_DATA_DECRYPTION_KEYS: z.string().default(''),
  PARTY_CONTACT_LOOKUP_KEY: hexKey,
  AUTH_RATE_LIMIT_KEY: hexKey,
  S3_ENDPOINT: z.url().default('http://localhost:59000'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(3).max(63).default('rerms-private-documents'),
  S3_ACCESS_KEY_ID: z.string().min(3).default('rerms-dev-access'),
  S3_SECRET_ACCESS_KEY: z.string().min(8).default('rerms-dev-secret'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  DOCUMENT_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(104_857_600).default(26_214_400),
});

export const seedEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironment,
  DATABASE_URL: z.string().min(1),
  SEED_ADMIN_EMAIL: z.email(),
  SEED_ADMIN_PASSWORD: z.string().min(12).max(128),
  SEED_COMPANY_CODE: z.string().min(2).max(32).default('RERMS'),
  SEED_BRANCH_CODE: z.string().min(2).max(32).default('HQ'),
});

export const webEnvironmentSchema = z.object({ NODE_ENV: nodeEnvironment, API_URL: z.url() });

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export type SeedEnvironment = z.infer<typeof seedEnvironmentSchema>;
export type WebEnvironment = z.infer<typeof webEnvironmentSchema>;

export function parseApiEnvironment(environment: NodeJS.ProcessEnv): ApiEnvironment {
  return apiEnvironmentSchema.parse(environment);
}

export function parseSeedEnvironment(environment: NodeJS.ProcessEnv): SeedEnvironment {
  return seedEnvironmentSchema.parse(environment);
}

export function parseWebEnvironment(environment: NodeJS.ProcessEnv): WebEnvironment {
  return webEnvironmentSchema.parse(environment);
}
