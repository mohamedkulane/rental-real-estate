import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, statSync, watch } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const appDirectory = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const typescriptCompiler = require.resolve('typescript/bin/tsc');
const distMain = join(appDirectory, 'dist/main.js');

function newestMtime(directory, extension) {
  let newest = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtime(path, extension));
    } else if (entry.name.endsWith(extension)) {
      newest = Math.max(newest, statSync(path).mtimeMs);
    }
  }
  return newest;
}

function outputIsFresh(outputPath, sourceDirectory, extension = '.ts') {
  try {
    return statSync(outputPath).mtimeMs >= newestMtime(sourceDirectory, extension);
  } catch {
    return false;
  }
}

function ensureWorkspacePackages() {
  const packages = [
    ['packages/shared/dist/index.js', 'packages/shared/src'],
    ['packages/config/dist/index.js', 'packages/config/src'],
    ['packages/database/dist/index.js', 'packages/database/src'],
  ];
  const stale = packages.some(([output, source]) =>
    !outputIsFresh(join(repoRoot, output), join(repoRoot, source)),
  );
  if (!stale) return;

  console.log('[api dev] Building workspace packages...');
  const build = spawnSync(
    'pnpm',
    ['--filter', '@rerms/shared', '--filter', '@rerms/config', '--filter', '@rerms/database', 'build'],
    { cwd: repoRoot, stdio: 'inherit', env: process.env, shell: true },
  );
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
}

function compileOnce() {
  if (outputIsFresh(distMain, join(appDirectory, 'src'))) {
    console.log('[api dev] Using existing build (source unchanged).');
    return;
  }

  console.log('[api dev] Compiling TypeScript...');
  const started = Date.now();
  const compilation = spawnSync(
    process.execPath,
    [typescriptCompiler, '-p', 'tsconfig.build.json', '--incremental'],
    { cwd: appDirectory, env: process.env, stdio: 'inherit' },
  );
  if (compilation.error) throw compilation.error;
  if (compilation.status !== 0) process.exit(compilation.status ?? 1);
  console.log(`[api dev] Compile finished in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

function startServer() {
  return spawn(process.execPath, [distMain], {
    cwd: appDirectory,
    env: process.env,
    stdio: 'inherit',
  });
}

function startWatchers() {
  let server = startServer();
  let restartTimer;
  let allowRestart = false;

  // Ignore dist churn from the initial `tsc --watch` pass so Nest can boot once.
  setTimeout(() => {
    allowRestart = true;
  }, 20_000);

  const scheduleRestart = () => {
    if (!allowRestart) return;
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      console.log('[api dev] Restarting after rebuild...');
      server.kill('SIGTERM');
      server = startServer();
    }, 400);
  };

  watch(distMain, scheduleRestart);

  const compiler = spawn(
    process.execPath,
    [typescriptCompiler, '-p', 'tsconfig.build.json', '--incremental', '--watch', '--preserveWatchOutput'],
    { cwd: appDirectory, env: process.env, stdio: 'inherit' },
  );

  const shutdown = (signal) => {
    clearTimeout(restartTimer);
    compiler.kill(signal);
    server.kill(signal);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  compiler.on('exit', (code) => process.exit(code ?? 0));
  server.on('exit', (code) => {
    if (code && code !== 0 && code !== null) process.exit(code);
  });
}

ensureWorkspacePackages();
compileOnce();
startWatchers();
