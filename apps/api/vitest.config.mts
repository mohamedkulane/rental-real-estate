import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 15_000,
    setupFiles: ['./test/setup-root-env.ts'],
  },
});
