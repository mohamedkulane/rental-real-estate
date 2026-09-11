import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { uuidv7 } from '@rerms/shared';
import { describe, expect, it } from 'vitest';
import { CreateWorkflowDraftDto, WorkflowDraftPayloadDto } from '../../src/workflow/workflow.dto';

describe('workflow input validation', () => {
  it('accepts canonical UUID-v7 selections in every reference array', async () => {
    const payload = plainToInstance(WorkflowDraftPayloadDto, { buildingIds: [uuidv7()], rentableSpaceIds: [uuidv7()], documentIds: [uuidv7()] });
    expect(await validate(payload)).toEqual([]);
  });
  it('rejects an omitted draft payload', async () => {
    const draft = plainToInstance(CreateWorkflowDraftDto, { branchId: uuidv7(), type: 'PROPERTY_ONBOARDING' });
    expect((await validate(draft)).some((error) => error.property === 'payload')).toBe(true);
  });
});
