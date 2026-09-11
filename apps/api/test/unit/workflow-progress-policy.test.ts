import { WorkflowType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { validateWorkflowProgress } from '../../src/workflow/workflow.policy';

describe('guided workflow progress policy', () => {
  it('enforces the ordered Property Onboarding prerequisites', () => {
    expect(() => validateWorkflowProgress(WorkflowType.PROPERTY_ONBOARDING, 2, {})).toThrow('Choose an Owner');
    expect(() => validateWorkflowProgress(WorkflowType.PROPERTY_ONBOARDING, 3, { ownerPartyId: crypto.randomUUID() })).toThrow('Record the ownership shares');
  });

  it('keeps Rental Brokerage and Full Management distinct', () => {
    const ownerPartyId = crypto.randomUUID(); const propertyId = crypto.randomUUID(); const rentableSpaceIds = [crypto.randomUUID()]; const serviceEngagementId = crypto.randomUUID();
    expect(() => validateWorkflowProgress(WorkflowType.RENTAL_BROKERAGE, 6, { ownerPartyId, propertyId, rentableSpaceIds, serviceEngagementId })).toThrow('brokerage readiness');
    expect(() => validateWorkflowProgress(WorkflowType.RENTAL_BROKERAGE, 8, { ownerPartyId, propertyId, rentableSpaceIds, serviceEngagementId, readinessNotes: 'Ready' })).not.toThrow();
    expect(() => validateWorkflowProgress(WorkflowType.FULL_MANAGEMENT, 4, { ownerPartyId, propertyId })).toThrow('Ownership eligibility');
  });

  it('allows Company-owned sale intake without a fake external seller', () => {
    expect(() => validateWorkflowProgress(WorkflowType.PROPERTY_SALE, 8, { propertyId: crypto.randomUUID(), serviceEngagementId: crypto.randomUUID(), readinessNotes: 'Sale pack verified' })).not.toThrow();
  });
});
