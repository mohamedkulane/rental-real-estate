import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)));

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'pnpm --filter @rerms/database db:seed',
  },
});
