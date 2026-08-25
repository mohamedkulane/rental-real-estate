import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const required = [
  'README.md',
  'docs/README.md',
  'docs/design/Real_Estate_Rental_UI_UX_Design_System_v1.md',
  'docs/phases/phase-01-database/completion-report.md',
  'docs/phases/phase-02-foundation/completion-report.md',
  'docs/phases/phase-03-identity-access/completion-report.md',
  'docs/phases/phase-04-portfolio/completion-report.md',
  'docs/governance/current-phase.json',
  ...[
    '00-audit-summary.md',
    '01-confirmed-findings.md',
    '02-additional-findings.md',
    '03-remediation-plan.md',
    '04-security-privacy-review.md',
    '05-database-temporal-review.md',
    '06-test-gap-analysis.md',
    '07-remediation-results.md',
    'completion-report.md',
  ].map((name) => `docs/audits/pre-phase-05/${name}`),
];
const missing = required.filter((file) => !existsSync(join(root, file)));
if (missing.length)
  throw new Error(`Required governance files are missing:\n${missing.join('\n')}`);

for (const phase of ['01-database', '02-foundation', '03-identity-access', '04-portfolio']) {
  const report = readFileSync(
    join(root, `docs/phases/phase-${phase}/completion-report.md`),
    'utf8',
  );
  if (!/phase gate(?: result)?:\s*\*{0,2}pass/i.test(report))
    throw new Error(`Phase ${phase} completion report does not contain a PASS gate.`);
}

const metadata = JSON.parse(readFileSync(join(root, 'docs/governance/current-phase.json'), 'utf8'));
if (
  metadata.completedPhase !== 4 ||
  metadata.phase5Started !== true ||
  metadata.phase5SubPhase !== '5.1' ||
  metadata.currentGate !== 'PHASE_5_1_SERVICE_ENGAGEMENTS_PASS' ||
  metadata.productionSchemaScope !== 'PHASES_1_TO_5_1_ONLY'
)
  throw new Error(
    'Current phase metadata must show Phase 4 closed, Phase 5.1 passed, and Phase 5.2 not started.',
  );

const phase51Report = readFileSync(join(root, 'docs/phases/phase-05/completion-report.md'), 'utf8');
if (!/PHASE 5\.1 SERVICE ENGAGEMENTS:\s*PASS/i.test(phase51Report))
  throw new Error('Phase 5.1 completion report does not contain a PASS gate.');
if (!/PHASE 5\.2 STARTED:\s*NO/i.test(phase51Report))
  throw new Error('Phase 5.1 completion report must confirm Phase 5.2 has not started.');

const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const forbiddenModels = [
  'Lead',
  'Viewing',
  'RentalApplication',
  'Reservation',
  'Lease',
  'Invoice',
  'Payment',
  'JournalEntry',
  'SecurityDeposit',
  'MaintenanceRequest',
  'OwnerStatement',
];
const leaked = forbiddenModels.filter((name) => new RegExp(`model\\s+${name}\\b`).test(schema));
if (leaked.length) throw new Error(`Unapproved future Prisma models found: ${leaked.join(', ')}`);

const schemaTables = new Set([...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((match) => match[1]));
const migrationRoot = join(root, 'prisma/migrations');
// Migration history is append-only. A table created in an early migration can
// legitimately be removed by a later migration, so compare the effective final
// state rather than every historical CREATE TABLE statement.
const migrationTables = new Set();
for (const entry of readdirSync(migrationRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const migration = join(migrationRoot, entry.name, 'migration.sql');
  if (!existsSync(migration)) continue;
  const sql = readFileSync(migration, 'utf8');
  for (const statement of sql.split(/;\s*(?:\r?\n|$)/)) {
    const create = /CREATE TABLE\s+"([^"]+)"/i.exec(statement);
    if (create) migrationTables.add(create[1]);
    const drop = /DROP TABLE(?:\s+IF EXISTS)?\s+"([^"]+)"/i.exec(statement);
    if (drop) migrationTables.delete(drop[1]);
  }
}
const schemaOnly = [...schemaTables].filter((table) => !migrationTables.has(table));
const migrationOnly = [...migrationTables].filter((table) => !schemaTables.has(table));
if (schemaOnly.length || migrationOnly.length)
  throw new Error(
    `Prisma/migration table drift. Schema only: ${schemaOnly.join(', ') || 'none'}; migrations only: ${migrationOnly.join(', ') || 'none'}`,
  );

try {
  execFileSync('git', ['check-ignore', 'docs/README.md'], { cwd: root, stdio: 'ignore' });
  throw new Error('Canonical docs are still ignored by Git.');
} catch (error) {
  if (error instanceof Error && error.message === 'Canonical docs are still ignored by Git.')
    throw error;
}

console.log(
  `Governance verified: ${schemaTables.size} operational models/tables, Phase 4 closed, Phase 5.1 passed, Phase 5.2 not started.`,
);
