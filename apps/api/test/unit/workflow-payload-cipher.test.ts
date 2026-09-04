import { describe, expect, it } from 'vitest';
import { WorkflowPayloadCipher } from '../../src/workflow/workflow-payload-cipher';

const environment = {
  PARTY_DATA_ENCRYPTION_KEY_VERSION: 'v1',
  PARTY_DATA_ENCRYPTION_KEY: '11'.repeat(32),
} as never;

describe('WorkflowPayloadCipher', () => {
  it('round-trips a typed draft without exposing plaintext', () => {
    const cipher = new WorkflowPayloadCipher(environment);
    const payload = { ownerMode: 'EXISTING', ownerPartyId: '11111111-1111-4111-8111-111111111111' };
    const encrypted = cipher.encrypt(payload);
    expect(encrypted).not.toContain('ownerPartyId');
    expect(cipher.decrypt(encrypted)).toEqual(payload);
  });

  it('rejects tampered draft payloads', () => {
    const cipher = new WorkflowPayloadCipher(environment);
    const encrypted = cipher.encrypt({ step: 1 });
    expect(() => cipher.decrypt(encrypted.slice(0, -2) + 'aa')).toThrow();
  });
});
