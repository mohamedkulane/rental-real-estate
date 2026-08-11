import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const environmentFile = fileURLToPath(new URL('.env', import.meta.url));
if (existsSync(environmentFile)) loadEnvFile(environmentFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'pnpm --filter @rerms/database db:seed',
  },
});
