import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Prisma operational schema boundary', () => {
  it('contains completed foundations through Phase 5.9 while excluding later modules', async () => {
    const schema = await readFile(resolve(process.cwd(), '../../prisma/schema.prisma'), 'utf8');
    expect(schema).toContain('model RentableSpace');
    expect(schema).toContain('model PropertyLifecycleHistory');
    expect(schema).toContain('model ServiceEngagement');
    expect(schema).toContain('model ServiceEngagementHistory');
    expect(schema).toContain('model Lead');
    expect(schema).toContain('model RentLeadPreference');
    expect(schema).toContain('model BuyLeadPreference');
    expect(schema).toContain('model SellLeadPreference');
    expect(schema).toContain('model ConstructionServiceLeadPreference');
    expect(schema).toContain('model RentalListing');
    expect(schema).toContain('model SaleListing');
    expect(schema).toContain('model Viewing');
    expect(schema).toContain('model RentalApplication');
    expect(schema).toContain('model Reservation');
    expect(schema).toContain('model TenantProfile');
    expect(schema).toContain('model Lease');
    expect(schema).toContain('model LeaseRenewal');
    expect(schema).toContain('model MoveIn');
    expect(schema).toContain('model WorkflowCommand');
    expect(schema).not.toMatch(
      /model\s+(Listing|Matching|JournalEntry|Payment|SaleDeal|ConstructionProject|ConstructionAgreement|DevelopmentProject)\s*\{/,
    );
    expect(schema).not.toMatch(/model\s+Unit\s*\{/);
    expect(schema).not.toMatch(/\bFloat\b/);
  });

  it('keeps CRM history relational, typed, and append-only at the native boundary', async () => {
    const schema = await readFile(resolve(process.cwd(), '../../prisma/schema.prisma'), 'utf8');
    const migration = await readFile(
      resolve(
        process.cwd(),
        '../../prisma/migrations/20260825180000_phase5_crm_foundation/migration.sql',
      ),
      'utf8',
    );

    expect(schema).toContain('model LeadPreferenceVersion');
    expect(schema).toContain('model LeadStageHistory');
    expect(schema).toContain('model LeadAssignment');
    expect(schema).toContain('model LeadBranchHistory');
    expect(schema).toContain('model LeadActivity');
    expect(schema).toContain('model LeadFollowUp');
    expect(schema).toContain('model LeadFollowUpOutcome');
    expect(schema).not.toMatch(/model Lead[\s\S]*?preferences\s+Json/u);
    expect(migration).toContain('lead_assignments_no_overlap');
    expect(migration).toContain('lead_branch_history_no_overlap');
    expect(migration).toContain('Preference version requires exactly one typed variant');
    expect(migration).toContain('trg_preserve_lead_activities');
    expect(migration).toContain('Terminal Leads cannot retain open Follow-ups');
  });

  it('preserves future conceptual models outside the production schema', async () => {
    const candidate = await readFile(
      resolve(process.cwd(), '../../docs/database/prisma-design/schema-candidate.prisma'),
      'utf8',
    );
    expect(candidate).toContain('model ServiceEngagement');
    expect(candidate).toContain('model JournalEntry');
  });
});
