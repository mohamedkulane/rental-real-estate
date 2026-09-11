// Frozen Phase 5.1 model inventory from durable baseline fbe04db.
export const baselineModels = `Company Branch Department User Session PasswordResetToken
Employee EmployeeBranchAssignment Role Permission RolePermission EmployeeRole Party
PartyBranchAssignment PersonProfile OrganizationProfile OwnerProfile ContactPoint Address
PartyRelationship Property PropertyLifecycleHistory Building PropertyBranchAssignment
PropertyOwnership PropertyOwnerEntitlement RentableSpaceType RentableSpace ServiceEngagement
ServiceEngagementHistory RentableSpaceVersion RentableSpaceParentHistory SpaceSuccessor
LandSpaceProfile ResidentialSpaceProfile CommercialSpaceProfile Amenity PropertyAmenity
SpaceAmenity ApprovalPolicy ApprovalRule ApprovalRequest ApprovalStep ApprovalDecision
AuditLog Document DocumentVersion DocumentLink`.split(/\s+/u);

// CRM intake only. A model outside this explicit inventory needs a new human-approved phase.
export const crmModels = `LeadSource Lead LeadPreferenceVersion RentLeadPreference
BuyLeadPreference SellLeadPreference ConstructionServiceLeadPreference LeadStageHistory
LeadIntentHistory LeadAssignment LeadBranchHistory LeadActivity LeadFollowUp
LeadFollowUpOutcome WorkflowDraft WorkflowCanonicalReference WorkflowCompletion`.split(/\s+/u);

export const crmReportPath = 'docs/phases/phase-05/crm-foundation/completion-report.md';
export const operationalClosureReportPath = 'docs/decisions/16-phase-5-operational-closure.md';

// Phase 5.3–5.9 operational leasing models approved on branch closure.
export const phase5OperationalModels = `RentalListing SaleListing Viewing RentalApplication Reservation
TenantProfile Lease LeaseParty LeaseVersion LeasePossession LeaseRenewal MoveIn WorkflowCommand`.split(
  /\s+/u,
);

export const reviewLabels = {
  'qa-findings.md': 'AUTOMATED QA',
  'security-findings.md': 'AUTHORIZATION REVIEW',
  'ux-findings.md': 'UI/UX REVIEW',
  'adversarial-findings.md': 'ADVERSARIAL REVIEW',
  'governance-findings.md': 'GOVERNANCE AUDIT',
};

export const phase59PassLabels = [
  'PHASE 5.9 OPERATIONAL CLOSURE',
  'SUB-PHASES 5.1 THROUGH 5.8',
  'GUIDED WORKFLOW UX',
  'AUTOMATED QA',
  'UI/UX REVIEW',
];

export const crmPassLabels = [
  'PHASE 5.2 CRM FOUNDATION',
  'GRAPH EXECUTION',
  'DOMAIN CONTRACT',
  'DATABASE CONTRACT',
  'AUTHORIZATION CONTRACT',
  'BACKEND/API',
  'FRONTEND/UI',
  'AUTOMATED QA',
  'UX REVIEW 1440/768/390',
  'ADVERSARIAL REVIEW',
  'GOVERNANCE AUDIT',
];

function requireLine(report, label, value, scope = 'closure') {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const lines = [...report.matchAll(new RegExp(`^${escaped}:[ \\t]*(.*)$`, 'gmu'))];
  if (lines.length !== 1 || lines[0][1].trim() !== value) {
    throw new Error(`${scope} evidence missing: ${label}: ${value}`);
  }
}

export function validateIndependentReviews(reports) {
  for (const [file, label] of Object.entries(reviewLabels)) {
    if (typeof reports[file] !== 'string') throw new Error(`Independent review missing: ${file}`);
    requireLine(reports[file], label, 'PASS');
    requireLine(reports[file], 'UNRESOLVED CRITICAL', '0');
    requireLine(reports[file], 'UNRESOLVED HIGH', '0');
    requireLine(reports[file], 'ALL MEDIUM FINDINGS DISPOSITIONED', 'YES');
  }
}

export function validatePhaseMetadata(metadata, crmReport = '', operationalReport = '') {
  if (metadata.completedPhase !== 4 || metadata.phase5Started !== true) {
    throw new Error('Phase 4 closure and the approved Phase 5 start must remain recorded.');
  }
  if (metadata.phase5SubPhase === '5.9') {
    if (
      metadata.currentGate !== 'PHASE_5_9_OPERATIONAL_CLOSURE_PASS' ||
      metadata.productionSchemaScope !== 'PHASES_1_TO_5_9_ONLY' ||
      metadata.phase6Started !== false ||
      metadata.canonicalClosureReport !== operationalClosureReportPath
    ) {
      throw new Error('Invalid Phase 5.9 closure metadata.');
    }
    for (const label of phase59PassLabels) {
      requireLine(operationalReport, label, 'PASS', 'Phase 5.9');
    }
    requireLine(operationalReport, 'PHASE 6 STARTED', 'NO', 'Phase 5.9');
    requireLine(operationalReport, 'UNRESOLVED CRITICAL', '0', 'Phase 5.9');
    requireLine(operationalReport, 'UNRESOLVED HIGH', '0', 'Phase 5.9');
    return {
      crmApproved: true,
      operationalApproved: true,
      gate: metadata.currentGate,
    };
  }
  if (metadata.phase5SubPhase === '5.1') {
    if (
      metadata.currentGate !== 'PHASE_5_1_SERVICE_ENGAGEMENTS_PASS' ||
      metadata.productionSchemaScope !== 'PHASES_1_TO_5_1_ONLY' ||
      metadata.canonicalClosureReport !== 'docs/phases/phase-05/completion-report.md'
    )
      throw new Error('Invalid Phase 5.1 gate metadata.');
    return { crmApproved: false, operationalApproved: false, gate: 'PHASE_5_1_SERVICE_ENGAGEMENTS_PASS' };
  }
  const gates = [
    'PHASE_5_2_CRM_FOUNDATION_IN_PROGRESS',
    'PHASE_5_2_CRM_FOUNDATION_FAIL',
    'PHASE_5_2_CRM_FOUNDATION_PASS',
  ];
  if (
    metadata.phase5SubPhase !== '5.2' ||
    !gates.includes(metadata.currentGate) ||
    metadata.productionSchemaScope !== 'PHASES_1_TO_5_2_ONLY' ||
    metadata.phase53Started !== false ||
    metadata.canonicalClosureReport !== crmReportPath ||
    metadata.graphRun !== '.codex/graphs/runs/phase-05-02'
  )
    throw new Error('Only explicitly governed Phase 5.2 is authorized; Phase 5.3 remains blocked.');

  requireLine(crmReport, 'PHASE 5.3 STARTED', 'NO');
  if (metadata.currentGate === 'PHASE_5_2_CRM_FOUNDATION_PASS') {
    for (const label of crmPassLabels) requireLine(crmReport, label, 'PASS');
    requireLine(crmReport, 'UNRESOLVED CRITICAL', '0');
    requireLine(crmReport, 'UNRESOLVED HIGH', '0');
    requireLine(crmReport, 'ALL MEDIUM FINDINGS DISPOSITIONED', 'YES');
  } else {
    requireLine(crmReport, 'PHASE 5.2 CRM FOUNDATION', 'FAIL');
  }
  return { crmApproved: true, operationalApproved: false, gate: metadata.currentGate };
}

export function validateModelInventory(schema, crmApproved, operationalApproved = false) {
  const actual = new Set(
    [...schema.matchAll(/^\s*model\s+(\w+)\s*\{/gmu)].map((match) => match[1]),
  );
  const expected = new Set([
    ...baselineModels,
    ...(crmApproved ? crmModels : []),
    ...(operationalApproved ? phase5OperationalModels : []),
  ]);
  const unapproved = [...actual].filter((name) => !expected.has(name));
  const missing = [...expected].filter((name) => !actual.has(name));
  if (unapproved.length || missing.length) {
    throw new Error(
      `Phase model inventory mismatch. Unapproved: ${unapproved.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}`,
    );
  }
}
