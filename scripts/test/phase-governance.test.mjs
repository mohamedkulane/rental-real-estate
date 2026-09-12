import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  baselineModels,
  crmModels,
  crmPassLabels,
  crmReportPath,
  operationalClosureReportPath,
  phase5OperationalModels,
  phase59PassLabels,
  phase6FinanceModels,
  phase7CommercialModels,
  phase8ClosureReportPath,
  phase8OperationsModels,
  phase813PassLabels,
  phase9ClosureReportPath,
  phase913PassLabels,
  phase9PortalModels,
  phase10ClosureReportPath,
  phase10ConstructionModels,
  phase1026PassLabels,
  reviewLabels,
  validateIndependentReviews,
  validateModelInventory,
  validatePhaseMetadata,
} from '../lib/phase-governance.mjs';

const baseline = {
  completedPhase: 4,
  phase5Started: true,
  phase5SubPhase: '5.1',
  currentGate: 'PHASE_5_1_SERVICE_ENGAGEMENTS_PASS',
  productionSchemaScope: 'PHASES_1_TO_5_1_ONLY',
  canonicalClosureReport: 'docs/phases/phase-05/completion-report.md',
};

test('requires each independent review, not just the closure summary', () => {
  assert.throws(() => validateIndependentReviews({}), /Independent review missing/u);
  const reports = Object.fromEntries(
    Object.entries(reviewLabels).map(([file, label]) => [
      file,
      `${label}: PASS\nUNRESOLVED CRITICAL: 0\nUNRESOLVED HIGH: 0\nALL MEDIUM FINDINGS DISPOSITIONED: YES`,
    ]),
  );
  validateIndependentReviews(reports);
  for (const [file, label] of Object.entries(reviewLabels)) {
    assert.throws(() =>
      validateIndependentReviews({
        ...reports,
        [file]: reports[file].replace(`${label}: PASS`, `${label}: FAIL`),
      }),
    );
    assert.throws(() =>
      validateIndependentReviews({
        ...reports,
        [file]: reports[file].replace('UNRESOLVED HIGH: 0', 'UNRESOLVED HIGH: 1'),
      }),
    );
  }
});
const active = {
  ...baseline,
  phase5SubPhase: '5.2',
  currentGate: 'PHASE_5_2_CRM_FOUNDATION_IN_PROGRESS',
  productionSchemaScope: 'PHASES_1_TO_5_2_ONLY',
  phase53Started: false,
  canonicalClosureReport: crmReportPath,
  graphRun: '.codex/graphs/runs/phase-05-02',
};
const incomplete = 'PHASE 5.2 CRM FOUNDATION: FAIL\nPHASE 5.3 STARTED: NO\n';
const schema = (names) => names.map((name) => `model ${name} {\n}`).join('\n');
const complete = [
  ...crmPassLabels.map((label) => `${label}: PASS`),
  'UNRESOLVED CRITICAL: 0',
  'UNRESOLVED HIGH: 0',
  'ALL MEDIUM FINDINGS DISPOSITIONED: YES',
  'PHASE 5.3 STARTED: NO',
].join('\n');

test('preserves the historical Phase 5.1 gate and forbids early CRM', () => {
  assert.equal(validatePhaseMetadata(baseline).crmApproved, false);
  validateModelInventory(schema(baselineModels), false);
  assert.throws(
    () => validateModelInventory(schema([...baselineModels, 'Lead']), false),
    /Unapproved: Lead/u,
  );
});
test('accepts approved in-progress CRM without claiming closure', () => {
  assert.equal(validatePhaseMetadata(active, incomplete).gate, active.currentGate);
  validateModelInventory(schema([...baselineModels, ...crmModels]), true);
  assert.throws(() => validatePhaseMetadata(active, complete), /CRM FOUNDATION: FAIL/u);
});
test('rejects later phase metadata and widened schema scope', () => {
  for (const patch of [
    { phase5SubPhase: '5.3' },
    { phase53Started: true },
    { productionSchemaScope: 'ALL_PHASES' },
    { graphRun: 'unapproved' },
  ]) {
    assert.throws(() => validatePhaseMetadata({ ...active, ...patch }, incomplete));
  }
});
test('accepts Phase 5.9 closure metadata and operational inventory', () => {
  const phase59 = {
    completedPhase: 4,
    phase5Started: true,
    phase5SubPhase: '5.9',
    currentGate: 'PHASE_5_9_OPERATIONAL_CLOSURE_PASS',
    productionSchemaScope: 'PHASES_1_TO_5_9_ONLY',
    phase6Started: false,
    phase53Started: true,
    canonicalClosureReport: operationalClosureReportPath,
    graphRun: '.codex/graphs/runs/workflow-ux-wave1',
  };
  const operationalComplete = [
    ...phase59PassLabels.map((label) => `${label}: PASS`),
    'PHASE 6 STARTED: NO',
    'UNRESOLVED CRITICAL: 0',
    'UNRESOLVED HIGH: 0',
  ].join('\n');
  const result = validatePhaseMetadata(phase59, '', operationalComplete);
  assert.equal(result.operationalApproved, true);
  validateModelInventory(
    schema([...baselineModels, ...crmModels, ...phase5OperationalModels]),
    true,
    true,
  );
  assert.throws(() => validatePhaseMetadata({ ...phase59, phase6Started: true }, '', operationalComplete));
});
test('rejects every prohibited future-domain model and unknown additions', () => {
  for (const future of [
    'RentalListing',
    'SaleListing',
    'Listing',
    'Matching',
    'Viewing',
    'RentalApplication',
    'Reservation',
    'Lease',
    'Invoice',
    'Payment',
    'SaleDeal',
    'ConstructionProject',
    'ConstructionContract',
    'ConstructionPaymentPlan',
    'DevelopmentProject',
    'UnknownModel',
  ]) {
    assert.throws(
      () => validateModelInventory(schema([...baselineModels, ...crmModels, future]), true),
      /Unapproved:/u,
    );
  }
});
test('rejects missing canonical models', () => {
  assert.throws(
    () =>
      validateModelInventory(
        schema([...baselineModels, ...crmModels.filter((name) => name !== 'Lead')]),
        true,
      ),
    /missing: Lead/u,
  );
});
test('does not miss indented future models', () => {
  assert.throws(
    () =>
      validateModelInventory(
        `${schema([...baselineModels, ...crmModels])}\n  model Lease {\n}`,
        true,
      ),
    /Unapproved: Lease/u,
  );
});
test('rejects premature PASS and accepts only a complete closure declaration', () => {
  const passed = { ...active, currentGate: 'PHASE_5_2_CRM_FOUNDATION_PASS' };
  assert.throws(() => validatePhaseMetadata(passed, incomplete));
  assert.throws(() => validatePhaseMetadata(passed, `${complete}\nPHASE 5.2 CRM FOUNDATION: FAIL`));
  for (const label of crmPassLabels) {
    assert.throws(() =>
      validatePhaseMetadata(passed, complete.replace(`${label}: PASS`, `${label}: FAIL`)),
    );
  }
  for (const [from, to] of [
    ['UNRESOLVED HIGH: 0', 'UNRESOLVED HIGH: 1'],
    ['UNRESOLVED CRITICAL: 0', 'UNRESOLVED CRITICAL: 1'],
    ['ALL MEDIUM FINDINGS DISPOSITIONED: YES', 'ALL MEDIUM FINDINGS DISPOSITIONED: NO'],
  ]) {
    assert.throws(() => validatePhaseMetadata(passed, complete.replace(from, to)));
  }
  assert.equal(validatePhaseMetadata(passed, complete).gate, passed.currentGate);
});
test('accepts Phase 8 operations closure metadata and inventory', () => {
  const phase8 = {
    completedPhase: 8,
    phase5Started: true,
    phase5SubPhase: '8.13',
    currentGate: 'PHASE_8_13_OPERATIONS_CLOSURE_PASS',
    productionSchemaScope: 'PHASES_1_TO_8_ONLY',
    canonicalClosureReport: phase8ClosureReportPath,
    graphRun: '.codex/graphs/runs/workflow-ux-wave1',
    phase53Started: true,
    phase6Started: true,
    phase7Started: true,
    phase8Started: true,
  };
  const operationsComplete = [
    ...phase813PassLabels.map((label) => `${label}: PASS`),
    'PHASE 9 STARTED: NO',
    'UNRESOLVED CRITICAL: 0',
    'UNRESOLVED HIGH: 0',
  ].join('\n');
  const result = validatePhaseMetadata(phase8, '', '', '', '', operationsComplete);
  assert.equal(result.operationsApproved, true);
  validateModelInventory(
    schema([
      ...baselineModels,
      ...crmModels,
      ...phase5OperationalModels,
      ...phase6FinanceModels,
      ...phase7CommercialModels,
      ...phase8OperationsModels,
    ]),
    true,
    true,
    true,
    true,
    true,
  );
});

test('accepts Phase 9 portals closure metadata and inventory', () => {
  const phase9 = {
    completedPhase: 9,
    phase5Started: true,
    phase5SubPhase: '9.13',
    currentGate: 'PHASE_9_13_PORTALS_REPORTING_CLOSURE_PASS',
    productionSchemaScope: 'PHASES_1_TO_9_ONLY',
    canonicalClosureReport: phase9ClosureReportPath,
    graphRun: '.codex/graphs/runs/workflow-ux-wave1',
    phase53Started: true,
    phase6Started: true,
    phase7Started: true,
    phase8Started: true,
    phase9Started: true,
  };
  const portalsComplete = [
    ...phase913PassLabels.map((label) => `${label}: PASS`),
    'PHASE 10 STARTED: NO',
    'UNRESOLVED CRITICAL: 0',
    'UNRESOLVED HIGH: 0',
  ].join('\n');
  const result = validatePhaseMetadata(phase9, '', '', '', '', '', portalsComplete);
  assert.equal(result.portalsApproved, true);
  validateModelInventory(
    schema([
      ...baselineModels,
      ...crmModels,
      ...phase5OperationalModels,
      ...phase6FinanceModels,
      ...phase7CommercialModels,
      ...phase8OperationsModels,
      ...phase9PortalModels,
    ]),
    true,
    true,
    true,
    true,
    true,
    true,
  );
});

test('accepts Phase 10 construction closure metadata and inventory', () => {
  const phase10 = {
    completedPhase: 10,
    phase5Started: true,
    phase5SubPhase: '10.26',
    currentGate: 'PHASE_10_CONSTRUCTION_DEVELOPMENT_CLOSURE_PASS',
    productionSchemaScope: 'PHASES_1_TO_10_ONLY',
    canonicalClosureReport: phase10ClosureReportPath,
    graphRun: '.codex/graphs/runs/workflow-ux-wave1',
    phase53Started: true,
    phase6Started: true,
    phase7Started: true,
    phase8Started: true,
    phase9Started: true,
    phase10Started: true,
  };
  const constructionComplete = [
    ...phase1026PassLabels.map((label) => `${label}: PASS`),
    'PHASE 11 STARTED: NO',
    'UNRESOLVED CRITICAL: 0',
    'UNRESOLVED HIGH: 0',
  ].join('\n');
  const result = validatePhaseMetadata(phase10, '', '', '', '', '', '', constructionComplete);
  assert.equal(result.constructionApproved, true);
  validateModelInventory(
    schema([
      ...baselineModels,
      ...crmModels,
      ...phase5OperationalModels,
      ...phase6FinanceModels,
      ...phase7CommercialModels,
      ...phase8OperationsModels,
      ...phase9PortalModels,
      ...phase10ConstructionModels,
    ]),
    true,
    true,
    true,
    true,
    true,
    true,
    true,
  );
  assert.throws(() =>
    validatePhaseMetadata({ ...phase10, phase10Started: false }, '', '', '', '', '', '', constructionComplete),
  );
});

