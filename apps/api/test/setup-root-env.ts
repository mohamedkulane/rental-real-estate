import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootEnvironmentPath = resolve(process.cwd(), '../../.env');

if (existsSync(rootEnvironmentPath)) {
  for (const rawLine of readFileSync(rootEnvironmentPath, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);

    process.env[key] ??= value;
  }
}
