import { describe, expect, it, vi } from 'vitest';
import { HealthController } from '../../src/health/health.controller';

describe('HealthController', () => {
  it('reports liveness without touching dependencies', () => {
    const controller = new HealthController(
      { $queryRaw: vi.fn() } as never,
      { ensureConnected: vi.fn() } as never,
      { checkHealth: vi.fn() } as never,
    );
    expect(controller.health()).toEqual({ status: 'ok', service: 'rerms-api' });
  });
});
