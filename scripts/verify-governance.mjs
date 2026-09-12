import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  crmReportPath,
  operationalClosureReportPath,
  phase6ClosureReportPath,
  phase7ClosureReportPath,
  phase8ClosureReportPath,
  phase9ClosureReportPath,
  reviewLabels,
  validateIndependentReviews,
  validateModelInventory,
  validatePhaseMetadata,
} from './lib/phase-governance.mjs';

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
  'scripts/lib/phase-governance.mjs',
  'scripts/test/phase-governance.test.mjs',
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
const crmReport = readFileSync(join(root, crmReportPath), 'utf8');
const operationalReport =
  metadata.phase5SubPhase === '5.9'
    ? readFileSync(join(root, operationalClosureReportPath), 'utf8')
    : '';
const financeReport =
  metadata.phase5SubPhase === '6.9' || metadata.phase7Started
    ? readFileSync(join(root, phase6ClosureReportPath), 'utf8')
    : '';
const commercialReport =
  metadata.phase5SubPhase === '7.13'
    ? readFileSync(join(root, phase7ClosureReportPath), 'utf8')
    : '';
const operationsReport =
  metadata.phase5SubPhase === '8.13'
    ? readFileSync(join(root, phase8ClosureReportPath), 'utf8')
    : '';
const portalsReport =
  metadata.phase5SubPhase === '9.13'
    ? readFileSync(join(root, phase9ClosureReportPath), 'utf8')
    : '';
const phase = validatePhaseMetadata(
  metadata,
  crmReport,
  operationalReport,
  financeReport,
  commercialReport,
  operationsReport,
  portalsReport,
);
if (
  phase.crmApproved &&
  metadata.phase5SubPhase === '5.2' &&
  !existsSync(join(root, metadata.graphRun, 'status.md'))
) {
  throw new Error('Approved Phase 5.2 graph run is missing.');
}
if (
  phase.operationalApproved &&
  metadata.phase5SubPhase === '5.9' &&
  !existsSync(join(root, metadata.graphRun, 'gate-report.md'))
) {
  throw new Error('Approved Phase 5.9 graph run is missing.');
}
if (phase.gate === 'PHASE_5_2_CRM_FOUNDATION_PASS') {
  validateIndependentReviews(
    Object.fromEntries(
      Object.keys(reviewLabels).map((file) => [
        file,
        readFileSync(join(root, metadata.graphRun, file), 'utf8'),
      ]),
    ),
  );
}

const phase51Report = readFileSync(join(root, 'docs/phases/phase-05/completion-report.md'), 'utf8');
if (!/PHASE 5\.1 SERVICE ENGAGEMENTS:\s*PASS/i.test(phase51Report))
  throw new Error('Phase 5.1 completion report does not contain a PASS gate.');
if (!/PHASE 5\.2 STARTED:\s*NO/i.test(phase51Report))
  throw new Error('Phase 5.1 completion report must confirm Phase 5.2 has not started.');

const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
validateModelInventory(
  schema,
  phase.crmApproved,
  phase.operationalApproved,
  phase.financeApproved,
  phase.commercialApproved,
  phase.operationsApproved,
  phase.portalsApproved,
);

const schemaTables = new Set([...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((match) => match[1]));
const migrationRoot = join(root, 'prisma/migrations');
// Migration history is append-only. A table created in an early migration can
// legitimately be removed by a later migration, so compare the effective final
// state rather than every historical CREATE TABLE statement.
const migrationTables = new Set();
for (const entry of readdirSync(migrationRoot, { withFileTypes: true }).sort((a, b) =>
  a.name.localeCompare(b.name),
)) {
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

let docsIgnored = false;
try {
  execFileSync('git', ['check-ignore', 'docs/README.md'], { cwd: root, stdio: 'ignore' });
  docsIgnored = true;
} catch (error) {
  // Exit 1 means not ignored. Missing Git/unsafe ownership/other errors are not success.
  if (error.status !== 1) throw error;
}
if (docsIgnored) throw new Error('Canonical docs are still ignored by Git.');

execFileSync(process.execPath, ['--test', join(root, 'scripts/test/phase-governance.test.mjs')], {
  cwd: root,
  stdio: 'inherit',
});

console.log(
  `Governance verified: ${schemaTables.size} operational models/tables; ${phase.gate}; production scope ${metadata.productionSchemaScope}.`,
);
