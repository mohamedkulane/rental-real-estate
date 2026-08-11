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
