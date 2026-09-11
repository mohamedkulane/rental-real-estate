import { describe, expect, it } from 'vitest';
import { workflowSteps } from './workflow-types';

describe('guided workflow information architecture', () => {
  it('keeps every approved workflow at eight resumable steps', () => {
    for (const steps of Object.values(workflowSteps)) expect(steps).toHaveLength(8);
  });

  it('keeps brokerage, management and sale semantics distinct', () => {
    expect(workflowSteps.RENTAL_BROKERAGE.map((step) => step.label)).toContain(
      'Brokerage Readiness',
    );
    expect(workflowSteps.FULL_MANAGEMENT.map((step) => step.label)).toContain('Management Terms');
    expect(workflowSteps.PROPERTY_SALE.map((step) => step.label)).toContain('Sale Readiness');
  });
});
