import { readFileSync, writeFileSync } from 'node:fs';

const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);

function topLevelTokens(source) {
  const tokens = [];
  let token = '';
  let depth = 0;
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      token += character;
      if (character === quote && source[index - 1] !== '\\') quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      token += character;
      continue;
    }
    if (character === '(' || character === '[') depth += 1;
    if (character === ')' || character === ']') depth -= 1;
    if (/\s/.test(character) && depth === 0) {
      if (token) tokens.push(token);
      token = '';
    } else token += character;
  }
  if (token) tokens.push(token);
  return tokens;
}

function expandDeclaration(line) {
  const match = line.match(/^(enum|model)\s+(\w+)\s*\{\s*(.*)\s*\}\s*$/);
  if (!match) return line;
  const [, kind, name, body] = match;
  const tokens = topLevelTokens(body);
  const declarations = [];
  if (kind === 'enum') declarations.push(...tokens);
  else {
    for (let index = 0; index < tokens.length;) {
      if (tokens[index].startsWith('@@')) {
        declarations.push(tokens[index]);
        index += 1;
        continue;
      }
      const field = [tokens[index], tokens[index + 1]];
      index += 2;
      while (
        index < tokens.length &&
        tokens[index].startsWith('@') &&
        !tokens[index].startsWith('@@')
      ) {
        field.push(tokens[index]);
        index += 1;
      }
      declarations.push(field.join(' '));
    }
  }
  return `${kind} ${name} {\n${declarations.map((entry) => `  ${entry}`).join('\n')}\n}`;
}

const original = readFileSync(schemaPath, 'utf8');
const normalized = original
  .replace(
    '// PHASE 1 REVIEW CANDIDATE ONLY. Do not promote or migrate without gate approval.',
    '// Phase 1 schema promoted for Phase 2 validation; no migrations have been created or applied.',
  )
  .split(/\r?\n/)
  .map(expandDeclaration)
  .join('\n');
writeFileSync(schemaPath, `${normalized.trimEnd()}\n`, 'utf8');
