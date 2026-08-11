import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceExtensions = new Set(['.ts', '.tsx', '.css']);
const corruptedSequences = [
  String.fromCodePoint(0x00e2, 0x20ac),
  String.fromCodePoint(0x00c2, 0x00b7),
  String.fromCodePoint(0x00c3),
  String.fromCodePoint(0xfffd),
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

describe('source text encoding', () => {
  it('contains no common UTF-8 mojibake sequences', () => {
    const sourceRoot = resolve(process.cwd(), 'src');
    const affected = sourceFiles(sourceRoot).filter((file) => {
      const content = readFileSync(file, 'utf8');
      return corruptedSequences.some((sequence) => content.includes(sequence));
    });

    expect(affected).toEqual([]);
  });
});
