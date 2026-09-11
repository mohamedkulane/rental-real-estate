import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { LoggerOptions } from 'pino';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const routeSegments = new Set([
  'api',
  'v1',
  'crm',
  'leads',
  'pipeline',
  'follow-ups',
  'lead-sources',
  'options',
  'selectors',
  'branches',
  'employees',
  'parties',
  'properties',
  'spaces',
  'history',
  'activities',
  'correction',
  'void',
  'assignments',
  'assign',
  'reassign',
  'unassign',
  'branch-transfer',
  'intent-correction',
  'party-link',
  'party-unlink',
  'contacted',
  'qualified',
  'matching',
  'nurturing',
  'converted',
  'lost',
  'complete',
  'cancel',
  'deactivate',
  'reactivate',
]);
const errorCodes = new Set([
  'CRM_VALIDATION_FAILED',
  'CRM_ILLEGAL_TRANSITION',
  'CRM_QUALIFICATION_REQUIRED',
  'CRM_CAPABILITY_DENIED',
  'CRM_INELIGIBLE_EMPLOYEE',
  'CRM_FORBIDDEN',
  'CRM_NOT_FOUND',
  'CRM_VERSION_CONFLICT',
  'CRM_SOURCE_CODE_CONFLICT',
  'CRM_SEARCH_RATE_LIMITED',
  'CRM_INTERNAL_ERROR',
]);
const identifierFields = [
  'correlationId',
  'companyId',
  'branchId',
  'leadId',
  'targetId',
  'actorUserId',
  'userId',
  'employeeId',
  'followUpId',
  'activityId',
  'sourceId',
  'propertyId',
  'rentableSpaceId',
  'partyId',
] as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function pathname(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Inspect the path, never a query value that happens to mention CRM. Avoid URL
  // normalization hiding a CRM prefix on a malformed/dot-segment request.
  let path = value.replace(/^https?:\/\/[^/]+/iu, '').split(/[?#]/u, 1)[0] ?? '';
  try {
    path = decodeURIComponent(path);
  } catch {
    /* Invalid URLs remain safely redacted. */
  }
  return path.replace(/\\/gu, '/').replace(/\/{2,}/gu, '/');
}

function crmPathname(value: unknown): string | undefined {
  const pattern = /^\/(?:api\/v1\/)?crm(?:\/|$)/iu;
  const path = pathname(value);
  if (pattern.test(path)) return path;
  const relative =
    typeof value === 'string' ? pathname(value.replace(/^\/\/[^/]+(?=\/)/u, '')) : '';
  return pattern.test(relative) ? relative : undefined;
}

function crmUrl(value: unknown): boolean {
  return crmPathname(value) !== undefined;
}

function crmRequest(value: unknown): boolean {
  const request = record(value);
  const raw = record(request.raw);
  return [request.originalUrl, request.url, request.path, raw.originalUrl, raw.url].some(crmUrl);
}

/** True when a request belongs to the CRM surface, including a CRM path on a
 * malformed/early request object. Consumers that log exceptions use this same
 * scope test so parser and controller failures cannot bypass CRM privacy. */
export function isCrmRequest(value: unknown): boolean {
  return crmRequest(value);
}

function safePath(value: unknown): string {
  return (crmPathname(value) ?? '/crm/[redacted]')
    .split('/')
    .map((segment) => {
      if (!segment || routeSegments.has(segment.toLowerCase())) return segment.toLowerCase();
      return uuid.test(segment) ? segment : '[redacted]';
    })
    .join('/');
}

/** pino-http calls this AFTER its standard serializer (wrapSerializers=true).
 * Return a new allowlist: the standard serializer includes query/params and a
 * non-enumerable raw request, so deleting url alone is not a privacy boundary.
 */
export function serializeCrmSafeRequest(value: unknown): Record<string, unknown> {
  const request = record(value);
  if (!crmRequest(request)) {
    const headers = { ...record(request.headers) };
    // A navigation from CRM can carry its protected query even to a non-CRM route.
    for (const name of Object.keys(headers)) {
      const values: unknown[] = Array.isArray(headers[name])
        ? (headers[name] as unknown[])
        : [headers[name]];
      if (['referer', 'referrer'].includes(name.toLowerCase()) && values.some(crmUrl))
        headers[name] = '[redacted CRM referrer]';
    }
    return { ...request, headers };
  }
  const raw = record(request.raw);
  const id = request.id;
  const method = typeof request.method === 'string' ? request.method.toUpperCase() : '';
  return {
    id:
      typeof id === 'string' && uuid.test(id)
        ? id
        : typeof id === 'number' && Number.isSafeInteger(id)
          ? id
          : undefined,
    method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)
      ? method
      : 'UNKNOWN',
    url: safePath(
      [raw.originalUrl, request.originalUrl, request.url, request.path, raw.url].find(crmUrl),
    ),
    remoteAddress:
      typeof request.remoteAddress === 'string' && isIP(request.remoteAddress)
        ? request.remoteAddress
        : undefined,
    remotePort: typeof request.remotePort === 'number' ? request.remotePort : undefined,
  };
}

/** Preserve supplied non-CRM IDs; never bind arbitrary caller text as a CRM ID. */
export function crmSafeRequestId(request: unknown, candidate: unknown): string | number {
  if (crmRequest(request))
    return typeof candidate === 'string' && uuid.test(candidate) ? candidate : randomUUID();
  return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : randomUUID();
}

/** Correlation IDs are caller-controlled until validated by the middleware. */
export function crmSafeCorrelationId(value: unknown): string {
  return typeof value === 'string' && uuid.test(value) ? value : 'unknown';
}

export const crmHttpLogPrivacy = {
  serializers: { req: serializeCrmSafeRequest },
  hooks: {
    logMethod(args, method, level) {
      const value = record(args[0]);
      const bindings = record(this.bindings());
      if (!crmRequest(bindings.req) && !crmRequest(value.req)) {
        method.apply(this, args);
        return;
      }
      // Applies to automatic completion AND Nest's request-scoped application
      // logger. Error serializers otherwise copy message/stack/cause/Prisma meta;
      // redaction paths cannot safely enumerate arbitrary free-text payloads.
      const safe: Record<string, unknown> = { context: 'CRM' };
      if (crmRequest(value.req)) safe.req = value.req;
      for (const field of identifierFields) {
        const identifier = value[field];
        if (typeof identifier === 'string' && uuid.test(identifier)) safe[field] = identifier;
      }
      const status = record(value.res).statusCode ?? value.statusCode;
      if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599)
        safe.statusCode = status;
      if (typeof value.responseTime === 'number' && Number.isFinite(value.responseTime))
        safe.responseTime = value.responseTime;
      const code = value.code ?? record(value.err).code;
      if (typeof code === 'string' && errorCodes.has(code)) safe.code = code;
      const failed =
        Boolean(value.err) || level >= 50 || (typeof status === 'number' && status >= 500);
      if (failed && !safe.code) safe.code = 'CRM_INTERNAL_ERROR';
      const message = failed
        ? 'CRM request failed'
        : typeof status === 'number'
          ? 'CRM request completed'
          : 'CRM event';
      method.call(this, safe, message);
    },
  },
} satisfies Pick<LoggerOptions, 'serializers' | 'hooks'>;
