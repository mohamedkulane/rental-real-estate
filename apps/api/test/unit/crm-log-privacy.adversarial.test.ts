import { All, Controller, Req, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { LoggerModule, Logger as PinoNestLogger } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter';
import { crmHttpLogPrivacy, crmSafeRequestId } from '../../src/common/crm-log-privacy';

const secret = 'adversarial-private-contact@example.test';
const protectedUrl = `/api/v1/crm/leads?search=${encodeURIComponent(secret)}`;
const output: string[] = [];

@Controller()
class EarlyFailureProbeController {
  @All('{*path}')
  handle(@Req() req: Request): never {
    throw Object.assign(new Error(`Private failure ${secret} ${req.originalUrl}`), {
      cause: new Error(secret),
      meta: { ciphertext: secret, hmac: secret },
    });
  }
}

describe('CRM privacy across early parser and global exception boundaries', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: [
            {
              level: 'info',
              genReqId: (req) => crmSafeRequestId(req, req.headers['x-correlation-id'] ?? req.id),
              ...crmHttpLogPrivacy,
              redact: ['req.headers.authorization', 'req.headers.cookie'],
            },
            {
              write: (line: string) => {
                output.push(line);
              },
            },
          ],
        }),
      ],
      controllers: [EarlyFailureProbeController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useLogger(app.get(PinoNestLogger));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    output.length = 0;
  });
  afterAll(async () => {
    await app?.close();
  });

  const expectPrivateLogs = (): void => {
    expect(output.join('')).not.toContain(secret);
    expect(output.join('')).not.toContain(encodeURIComponent(secret));
    expect(output.join('')).not.toMatch(/"(?:ciphertext|hmac|stack|cause|meta)":/u);
  };

  it('does not leak a protected query when charset rejection precedes request context', async () => {
    const response = await request(app.getHttpServer())
      .post(protectedUrl)
      .set('Content-Type', 'application/json; charset=bogus')
      .send('{}');
    expect(response.status).toBeGreaterThanOrEqual(400);
    expectPrivateLogs();
  });

  it('does not leak a protected query when oversized JSON precedes request context', async () => {
    const response = await request(app.getHttpServer())
      .post(protectedUrl)
      .send({ notes: 'x'.repeat(110_000), contact: secret });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expectPrivateLogs();
  });

  it('keeps malformed JSON private as a separate mapped-SyntaxError control', async () => {
    await request(app.getHttpServer())
      .post(protectedUrl)
      .set('Content-Type', 'application/json')
      .send('{broken')
      .expect(400);
    expectPrivateLogs();
  });

  it('keeps actual global-filter controller errors private within CRM context', async () => {
    await request(app.getHttpServer()).get(protectedUrl).expect(500);
    expect(output.length).toBeGreaterThan(0);
    expectPrivateLogs();
    expect(output.join('')).toContain('CRM_INTERNAL_ERROR');
  });

  it('preserves non-CRM global-filter diagnostics', async () => {
    await request(app.getHttpServer()).get('/api/v1/health?probe=diagnostic').expect(500);
    expect(output.join('')).toContain('Unhandled API error GET /api/v1/health?probe=diagnostic');
    expect(output.join('')).toContain('Private failure');
  });
});
