import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  function capture(exception: unknown) {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    filter.catch(exception, {
      switchToHttp: () => ({
        getRequest: () => ({ correlationId: 'corr-test', method: 'POST', originalUrl: '/test' }),
        getResponse: () => ({ status, json }),
      }),
    } as never);
    return { status, json };
  }

  it('maps deferred trigger failures from exception.message to a 409 conflict', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.property.update()` invocation: Raw query failed. Code: `P0001`. Message: `ERROR: Active Property ownership must total 100%, got 0.000000`',
      { code: 'P2010', clientVersion: 'test' },
    );
    const { status, json } = capture(error);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: 'DATA_CONFLICT',
        message: 'Active Property ownership must total 100% for the effective period.',
        correlationId: 'corr-test',
      }),
    );
  });
});
