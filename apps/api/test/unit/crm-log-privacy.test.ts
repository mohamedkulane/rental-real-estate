import { All, Controller, Inject, Logger, Req, Res, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { LoggerModule, Logger as PinoNestLogger, PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crmHttpLogPrivacy, crmSafeRequestId } from '../../src/common/crm-log-privacy';

const secret = 'private-contact-needle@example.test';
const leadId = '019d0000-0000-7000-8000-000000000001';
const correlationId = '019d0000-0000-7000-8000-000000000002';
const companyId = '019d0000-0000-7000-8000-000000000003';
const output: string[] = [];

@Controller()
class LogProbeController {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {}

  @All('{*path}')
  handle(@Req() req: Request, @Res() res: Response): void {
    if (req.headers['x-probe-error'] === '1') {
      const error = Object.assign(new Error(`SELECT contact FROM leads: ${secret}`), {
        cause: new Error(`Nested secret ${secret}`),
        code: 'P2010',
        meta: { message: secret, query: req.originalUrl, ciphertext: secret, hmac: secret },
      });
      this.logger.error(
        { err: error, body: req.body as unknown, query: req.query, companyId },
        secret,
      );
      // Exercise Nest -> nestjs-pino's Error/stack adapter, not just a serializer.
      new Logger('CrmLogProbe').error(`Unhandled ${req.originalUrl} ${secret}`, error.stack);
      Object.assign(res, { err: error });
      res.setHeader('location', `/api/v1/crm/leads?search=${secret}`);
      res.setHeader('set-cookie', `private=${secret}`);
      res.status(500).json({ details: secret });
      return;
    }
    this.logger.info({ req, body: req.body as unknown, query: req.query, companyId }, secret);
    if (req.headers['x-probe-code'] === '1')
      this.logger.warn({ code: 'CRM_VERSION_CONFLICT', leadId, notes: secret }, secret);
    this.logger.info({ operation: 'health-check' }, 'Non-sensitive application event');
    res.status(200).json({ ok: true, queryIntact: req.query.search === secret });
  }
}

interface LogRecord {
  req?: { id?: string; method: string; url: string; headers?: Record<string, string> };
  statusCode?: number;
  responseTime?: number;
  companyId?: string;
  leadId?: string;
  operation?: string;
  code?: string;
  msg?: string;
}

describe('CRM HTTP log privacy (real Nest / pino-http emitted JSON)', () => {
  let app: INestApplication;
  const records = (): LogRecord[] =>
    output
      .flatMap((line) => line.trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LogRecord);

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
      controllers: [LogProbeController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useLogger(app.get(PinoNestLogger));
    await app.init();
  });
  beforeEach(() => {
    output.length = 0;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('removes CRM query, params, headers/referrer and explicit request payload logs while retaining IDs', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/crm/leads/${leadId}?search=${encodeURIComponent(secret)}&hmac=${secret}`)
      .set('referer', `https://app.example/crm/leads?search=${secret}`)
      .set('x-private-note', secret)
      .set('x-correlation-id', correlationId)
      .expect(200);

    expect(response.body.queryIntact).toBe(true);
    expect(output.length).toBeGreaterThan(0);
    expect(output.join('')).not.toContain(secret);
    expect(output.join('')).not.toContain(encodeURIComponent(secret));
    expect(records().some((entry) => entry.companyId === companyId)).toBe(true);
    expect(records().every((entry) => entry.req?.url === `/api/v1/crm/leads/${leadId}`)).toBe(true);
    expect(records().every((entry) => entry.req?.id === correlationId)).toBe(true);
    expect(
      records().some((entry) => entry.statusCode === 200 && typeof entry.responseTime === 'number'),
    ).toBe(true);
    expect(output.join('')).not.toMatch(/"(?:headers|query|params|body)":/u);
  });

  it('removes body/free text, Prisma metadata, error cause/stack, and response headers from CRM errors', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/crm/leads?search=${secret}`)
      .set('x-probe-error', '1')
      .send({ phone: secret, notes: secret, ciphertext: secret, contactHash: secret })
      .expect(500);

    expect(output.length).toBeGreaterThanOrEqual(3);
    expect(output.join('')).not.toContain(secret);
    expect(output.join('')).not.toMatch(
      /SELECT contact|Nested secret|"stack"|"cause"|"meta"|"set-cookie"/u,
    );
    expect(records().some((entry) => entry.code === 'CRM_INTERNAL_ERROR')).toBe(true);
    expect(records().some((entry) => entry.statusCode === 500)).toBe(true);
    expect(records().every((entry) => entry.msg === 'CRM request failed')).toBe(true);
  });

  it('keeps allowlisted CRM error codes and resource IDs without free-text messages', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/crm/leads')
      .set('x-probe-code', '1')
      .expect(200);
    expect(
      records().some((entry) => entry.code === 'CRM_VERSION_CONFLICT' && entry.leadId === leadId),
    ).toBe(true);
    expect(output.join('')).not.toContain(secret);
  });

  it.each(['/API/v1/CrM/leads/', '/api/v1/%63rm/leads/', '/crm/leads/'])(
    'redacts untrusted path segments and supplied correlation text for %s',
    async (prefix) => {
      await request(app.getHttpServer())
        .get(`${prefix}${secret}?search=${secret}`)
        .set('x-correlation-id', secret)
        .expect(200);

      expect(output.length).toBeGreaterThan(0);
      expect(output.join('')).not.toContain(secret);
      expect(records().every((entry) => entry.req?.url.endsWith('/leads/[redacted]'))).toBe(true);
      expect(records().every((entry) => entry.req?.id?.match(/^[0-9a-f-]{36}$/u))).toBe(true);
    },
  );

  it('redacts CRM referrers on non-CRM requests without removing their operational URL or logs', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health?page=2')
      .set('referer', `https://app.example/crm/leads?search=${secret}`)
      .set('authorization', 'Bearer hidden-token')
      .set('cookie', 'session=hidden-cookie')
      .expect(200);

    const completed = records().find((entry) => entry.msg === 'request completed');
    expect(completed?.req?.url).toBe('/api/v1/health?page=2');
    expect(completed?.req?.headers?.referer).toBe('[redacted CRM referrer]');
    expect(completed?.req?.headers?.authorization).toBe('[Redacted]');
    expect(completed?.req?.headers?.cookie).toBe('[Redacted]');
    expect(records().some((entry) => entry.operation === 'health-check')).toBe(true);
    // The probe deliberately writes a non-CRM application message containing the
    // needle: only CRM scope is suppressed, not unrelated application diagnostics.
    expect(records().some((entry) => entry.msg === secret)).toBe(true);
  });
});
