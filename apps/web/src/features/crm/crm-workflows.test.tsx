import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiError, type Principal } from '@/lib/phase3-api';
import { can, canReadChild, crmError, requestPath } from './crm-data';
import { appendCursor, crmWorkspaceState, legalStageActions } from './crm-model';
import { followUpBody, stageBody } from './lead-commands';
import {
  PreferenceFields,
  preferenceValidation,
  PreferenceSummary,
  readPreference,
} from './crm-preferences';
import { sourceBody } from './lead-sources-workspace';
import { dateTimeInputValue } from './follow-ups-workspace';
import { LeadCards, WorkspaceBody } from './crm-shared';
import {
  leadIntents,
  leadStages,
  type FollowUpRecord,
  type LeadSourceRecord,
  type LeadSummary,
} from './crm-types';

const principal: Principal = {
  userId: 'actor',
  employeeId: 'employee',
  companyId: 'company',
  businessDate: '2026-08-31',
  accessMode: 'MULTI_BRANCH',
  roles: [],
  branches: [],
  branchIds: ['a', 'b'],
  permissions: ['crm.lead.read', 'crm.activity.read', 'crm.followup.read'],
  permissionBranchScopes: {
    'crm.lead.read': ['a'],
    'crm.activity.read': ['b'],
    'crm.followup.read': ['a'],
  },
};
const form = (values: Record<string, string>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};
const lead: LeadSummary = {
  id: 'internal-lead-id',
  leadNumber: 'LEAD-001',
  displayName: 'Amina',
  intent: 'CONSTRUCTION_SERVICE',
  stage: 'NEW',
  version: 2,
  createdAt: '2026-08-31T08:00:00Z',
  updatedAt: '2026-08-31T08:00:00Z',
  source: { id: 'internal-source-id', code: 'WEB', label: 'Website enquiry', status: 'INACTIVE' },
  responsibleBranch: { id: 'internal-branch-id', code: 'HOD', name: 'Hodan' },
  currentAssignee: null,
  contact: { hasPhone: true, hasEmail: false, phoneMasked: '****1234', emailMasked: null },
};
const followUp: FollowUpRecord = {
  id: 'task-id',
  leadId: lead.id,
  branchId: 'historical-branch',
  responsibleEmployeeId: 'old-employee',
  subject: 'Call customer',
  notes: null,
  state: 'OPEN',
  derivedStatus: 'OVERDUE',
  dueAt: '2026-08-30T08:00:00Z',
  version: 7,
  createdAt: '2026-08-29T08:00:00Z',
  updatedAt: '2026-08-29T08:00:00Z',
  outcomeAt: null,
  outcomeReason: null,
  predecessorFollowUpId: null,
  lead,
  responsibleEmployee: {
    id: 'old-employee',
    employeeNumber: 'EMP-001',
    displayName: 'Historical employee',
  },
};

describe('CRM authorization usability', () => {
  it('does not combine child and Lead permissions granted in different Branches', () => {
    expect(canReadChild(principal, 'crm.activity.read', 'a')).toBe(false);
    expect(canReadChild(principal, 'crm.activity.read', 'b')).toBe(false);
    expect(canReadChild(principal, 'crm.followup.read', 'a')).toBe(true);
  });
  it('does not derive an action permission from its neighboring read grant', () => {
    expect(can(principal, 'crm.followup.cancel', 'a')).toBe(false);
  });
  it('requires employee scope even with a null permission grant', () => {
    const restricted = {
      ...principal,
      branchIds: ['a'],
      permissionBranchScopes: { 'crm.lead.read': [null] },
    };
    expect(can(restricted, 'crm.lead.read', 'b')).toBe(false);
  });
});

describe('CRM list and cursor state', () => {
  it('preserves server-filtered follow-up dates in the local datetime input', () => {
    expect(dateTimeInputValue('2026-08-31T08:05:00.000Z')).toMatch(/^2026-08-31T/);
    expect(dateTimeInputValue(null)).toBe('');
    expect(dateTimeInputValue('not-a-date')).toBe('');
  });
  it('encodes repeated unbracketed filters and omits empty values', () => {
    const path = requestPath('/crm/leads', {
      stage: ['NEW', 'CONTACTED'],
      branchId: ['a', 'b'],
      search: '',
      limit: '25',
    });
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.getAll('stage')).toEqual(['NEW', 'CONTACTED']);
    expect(params.getAll('branchId')).toEqual(['a', 'b']);
    expect(params.has('search')).toBe(false);
    expect(path).not.toContain('[]');
    expect(params.get('limit')).toBe('25');
  });
  it('keeps a lane cursor scoped to its requested pipeline stage', () => {
    const path = requestPath('/crm/pipeline?intent=RENT', {
      pipelineStage: 'NEW',
      cursor: 'opaque-token',
      limit: '25',
    });
    expect(path).toBe('/crm/pipeline?intent=RENT&pipelineStage=NEW&cursor=opaque-token&limit=25');
  });
  it('drops abandoned forward pages when a new continuation is selected', () => {
    expect(appendCursor([undefined, 'old', 'abandoned'], 0, 'new')).toEqual([undefined, 'new']);
  });
  it.each([
    [{ loading: true, error: false, itemCount: 0, filtered: false }, 'loading'],
    [{ loading: false, error: true, itemCount: 2, filtered: false }, 'error'],
    [{ loading: false, error: false, itemCount: 0, filtered: false }, 'empty'],
    [{ loading: false, error: false, itemCount: 0, filtered: true }, 'filtered-empty'],
    [{ loading: false, error: false, itemCount: 2, filtered: true }, 'populated'],
  ] as const)('distinguishes %s as %s', (input, state) =>
    expect(crmWorkspaceState(input)).toBe(state),
  );
});

describe('closed Lead lifecycle', () => {
  for (const intent of leadIntents) {
    it(`${intent.label} never reopens a terminal Lead`, () => {
      expect(legalStageActions('CONVERTED', intent.value)).toEqual([]);
      expect(legalStageActions('LOST', intent.value)).toEqual([]);
    });
    it(`${intent.label} starts with contact or loss only`, () => {
      expect(legalStageActions('NEW', intent.value)).toEqual(['contacted', 'lost']);
      expect(legalStageActions('CONTACTED', intent.value)).toEqual(['qualified', 'lost']);
    });
  }
  it.each(['SELL', 'CONSTRUCTION_SERVICE'])('never offers Matching to %s', (intent) => {
    for (const stage of leadStages)
      expect(legalStageActions(stage, intent)).not.toContain('matching');
  });
  it('requires a named reference for Contacted and Nurturing', () => {
    expect(() => stageBody('contacted', form({}), 2, '')).toThrow('Activity');
    expect(() => stageBody('nurturing', form({ reason: 'Later contact' }), 2, '')).toThrow(
      'Follow-up',
    );
  });
  it('does not send unknown reason fields to terminal commands', () => {
    expect(
      stageBody(
        'converted',
        form({ outcomeSummary: 'External handoff', reason: 'ignored' }),
        3,
        '',
      ),
    ).toEqual({ expectedVersion: 3, outcomeSummary: 'External handoff' });
    expect(
      stageBody('lost', form({ lostReason: 'UNREACHABLE', reason: 'ignored' }), 3, ''),
    ).toEqual({ expectedVersion: 3, lostReason: 'UNREACHABLE' });
  });
  it('requires notes for the Other lost reason', () => {
    expect(() => stageBody('lost', form({ lostReason: 'OTHER' }), 1, '')).toThrow('Notes');
  });
  it('stores matching readiness without creating a matching request', () => {
    expect(
      stageBody('matching', form({ readinessLabel: 'Ready for later review' }), 4, ''),
    ).toEqual({ expectedVersion: 4, readinessLabel: 'Ready for later review' });
  });
});

describe('immutable Follow-up responsibility', () => {
  it('never PATCHes employee or historical Branch even when form contains them', () => {
    const body = followUpBody(
      'update',
      form({
        subject: 'New subject',
        dueAt: '2026-09-01T08:00:00Z',
        reason: 'Agreed new time',
        responsibleEmployeeId: 'attacker',
        branchId: 'new-branch',
      }),
      'new-employee',
      followUp,
    );
    expect(body).toEqual({
      subject: 'New subject',
      dueAt: '2026-09-01T08:00:00.000Z',
      reason: 'Agreed new time',
      expectedVersion: 7,
    });
    expect(body).not.toHaveProperty('responsibleEmployeeId');
    expect(body).not.toHaveProperty('branchId');
  });
  it('creates a linked successor without implicitly cancelling the predecessor', () => {
    const body = followUpBody(
      'successor',
      form({ subject: 'Call customer', dueAt: '2026-09-01T08:00:00Z' }),
      'eligible-employee',
      followUp,
    );
    expect(body.predecessorFollowUpId).toBe('task-id');
    expect(body.responsibleEmployeeId).toBe('eligible-employee');
    expect(body).not.toHaveProperty('state');
    expect(body).not.toHaveProperty('expectedVersion');
  });
  it('never auto-selects an employee for a new task', () => {
    expect(() =>
      followUpBody('create', form({ subject: 'Call', dueAt: '2026-09-01T08:00:00Z' }), ''),
    ).toThrow('Choose');
  });
  it.each(['complete', 'cancel'] as const)('%s uses only the version and reason', (action) => {
    expect(followUpBody(action, form({ reason: 'Reviewed outcome' }), 'ignored', followUp)).toEqual(
      { expectedVersion: 7, reason: 'Reviewed outcome' },
    );
  });
});

describe('typed preference forms', () => {
  it('drops cross-intent and internal fields rather than emitting arbitrary JSON', () => {
    const value = readPreference(
      'RENT',
      form({
        'preference.maxRent': '500.0000',
        'preference.currency': 'USD',
        'preference.projectBrief': 'Not a rental field',
        'preference.companyId': 'foreign',
        'preference.minBedrooms': '2',
        'preference.parkingRequired': 'false',
        'preference.preferredAreaText': 'Hodan\n Hodan \nWadajir',
      }),
    );
    expect(value).toEqual({
      preferredAreaText: ['Hodan', 'Wadajir'],
      maxRent: '500.0000',
      currency: 'USD',
      minBedrooms: 2,
      parkingRequired: false,
    });
  });
  it('validates ordered ranges', () => {
    expect(preferenceValidation({ minRent: '500', maxRent: '400' })).not.toBeNull();
    expect(preferenceValidation({ minRent: '400', maxRent: '500' })).toBeNull();
  });
  it('renders the construction brief and category as required without rental fields', () => {
    const html = renderToStaticMarkup(
      createElement(PreferenceFields, { intent: 'CONSTRUCTION_SERVICE' }),
    );
    expect(html).toContain('name="preference.projectBrief"');
    expect(html).toContain('name="preference.category"');
    expect(html).not.toContain('name="preference.maxRent"');
    expect(html).toContain('required');
  });
  it('does not change user narrative casing or expose private preference fields', () => {
    const html = renderToStaticMarkup(
      createElement(PreferenceSummary, {
        intent: 'RENT',
        preference: {
          notes: 'Keep my Exact CASE.',
          maxRent: '1200.50',
          currency: 'USD',
          actorUserId: 'private-actor',
          propertyId: 'private-property',
        },
      }),
    );
    expect(html).toContain('Keep my Exact CASE.');
    expect(html).toContain('USD 1200.50');
    expect(html).not.toContain('private-');
  });
});

describe('Source and safe display contracts', () => {
  it('never mutates an existing Source code', () => {
    const source: LeadSourceRecord = {
      id: 'source',
      code: 'OLD',
      label: 'Old label',
      status: 'ACTIVE',
      version: 4,
      sortOrder: 0,
      usageCount: 10,
    };
    expect(sourceBody(form({ code: 'NEW', label: 'New label', sortOrder: '1' }), source)).toEqual({
      expectedVersion: 4,
      label: 'New label',
      sortOrder: 1,
      description: null,
    });
  });
  it('normalizes a new permanent Source code', () => {
    expect(sourceBody(form({ code: ' web_form ', label: 'Web form' })).code).toBe('WEB_FORM');
  });
  it('shows business labels and historical inactive Source without raw IDs in text', () => {
    const html = renderToStaticMarkup(createElement(LeadCards, { items: [lead] }));
    const textOnly = html.replace(/<[^>]*>/g, '');
    expect(textOnly).toContain('Construction Service');
    expect(textOnly).toContain('Website enquiry (Inactive)');
    expect(textOnly).toContain('Unassigned');
    expect(textOnly).not.toContain('internal-');
    expect(textOnly).not.toContain('CONSTRUCTION_SERVICE');
  });
  it.each([400, 403, 404, 409, 500])('does not echo sensitive errors for HTTP %s', (status) => {
    expect(crmError(new ApiError('private database text 555-1234', status))).not.toContain(
      'private',
    );
  });
  it('renders filtered-empty guidance independently from a real empty dataset', () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceBody, {
        state: 'filtered-empty',
        emptyTitle: 'No Leads',
        emptyDescription: 'Create a Lead',
        filteredDescription: 'Clear filters',
        error: '',
        retry: () => undefined,
        children: 'unexpected records',
      }),
    );
    expect(html).toContain('No matching records');
    expect(html).toContain('Clear filters');
    expect(html).not.toContain('unexpected records');
  });
});
