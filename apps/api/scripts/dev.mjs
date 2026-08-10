import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const appDirectory = fileURLToPath(new URL('..', import.meta.url));
const typescriptCompiler = require.resolve('typescript/bin/tsc');

const compilation = spawnSync(process.execPath, [typescriptCompiler, '-p', 'tsconfig.build.json'], {
  cwd: appDirectory,
  env: process.env,
  stdio: 'inherit',
});

if (compilation.error) throw compilation.error;
if (compilation.status !== 0) process.exit(compilation.status ?? 1);

await import('../dist/main.js');
