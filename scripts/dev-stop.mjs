import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const webLockPath = join(repoRoot, 'apps/web/.next/dev/lock');
const devPorts = [3000, 3001, 3002];

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function collectListeningPids(port) {
  if (process.platform === 'win32') {
    try {
      const output = execSync(`netstat -ano | findstr ":${port}" | findstr LISTENING`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return [...output.matchAll(/LISTENING\s+(\d+)\s*$/gm)].map((match) => Number(match[1]));
    } catch {
      return [];
    }
  }

  try {
    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split(/\s+/)
      .map((value) => Number(value))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function pidIsAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPid(pid) {
  if (!pidIsAlive(pid)) return false;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(pid), '/F', '/T'], { stdio: 'ignore', shell: true });
    } else {
      process.kill(pid, 'SIGTERM');
    }
    return true;
  } catch {
    return false;
  }
}

function readLockPid() {
  if (!existsSync(webLockPath)) return null;
  try {
    const lock = JSON.parse(readFileSync(webLockPath, 'utf8'));
    return typeof lock.pid === 'number' ? lock.pid : null;
  } catch {
    return null;
  }
}

function removeStaleLock() {
  const lockPid = readLockPid();
  if (!lockPid || !pidIsAlive(lockPid)) {
    try {
      unlinkSync(webLockPath);
      console.log('[dev:stop] Removed stale Next.js dev lock.');
    } catch {
      // ignore missing lock
    }
  }
}

const targets = new Set([readLockPid(), ...devPorts.flatMap(collectListeningPids)].filter(Boolean));
let stopped = 0;

for (const pid of targets) {
  if (killPid(pid)) {
    stopped += 1;
    console.log(`[dev:stop] Stopped PID ${pid}.`);
  }
}

if (stopped > 0) sleep(1500);
removeStaleLock();

for (const port of devPorts) {
  const remaining = collectListeningPids(port);
  if (remaining.length) {
    console.error(`[dev:stop] Port ${port} is still in use by PID(s): ${remaining.join(', ')}`);
    process.exit(1);
  }
}

console.log('[dev:stop] Dev ports 3000-3002 are free.');
