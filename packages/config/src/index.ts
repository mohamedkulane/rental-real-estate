import { z } from 'zod';

const nodeEnvironment = z.enum(['development', 'test', 'production']).default('development');

export const apiEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironment,
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3001),
  WEB_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  PARTY_DATA_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'must be a 32-byte hexadecimal key'),
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
