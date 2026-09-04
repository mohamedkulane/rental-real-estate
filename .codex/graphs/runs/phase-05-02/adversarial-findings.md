# Adversarial findings

| ID  | Severity | Attacked invariant | Reproduction/evidence | Owner | Status/disposition | Repair SHA | Recheck |
| --- | -------- | ------------------ | --------------------- | ----- | ------------------ | ---------- | ------- |
| P502-SEC-002 | HIGH | CRM protected search/contact data must not enter application logs, including pre-controller failures | Unsupported charset and oversized JSON fail before request logging middleware; global exception filter logs original CRM URL outside request context | Agent 3 Security; Root must grant global exception-filter/composition boundary | OPEN: scoped repair is insufficient | `59bf377` -> `6891cde` | Independent real Nest/pino probes reproduced protected-query leakage on 2026-09-01 |

## Scoped log-privacy recheck — 2026-09-01

Candidate: `6891cde` (`59bf377` Security source). Production was read-only.
This is a bounded recheck of P502-SEC-002, not the full Phase 5.2 adversarial
review. API/UI are not yet a frozen integrated acceptance candidate.

SCOPED LOG PRIVACY RECHECK: FAIL

### Confirmed bypass: failure before request logging middleware

Affected source:

- `apps/api/src/common/crm-log-privacy.ts:175`: if neither current log arguments
  nor logger bindings contain a CRM request, the hook forwards arguments unchanged.
- `apps/api/src/common/api-exception.filter.ts:49`: body-parser HTTP errors that
  are not Nest HttpException instances fall through to status 500.
- `apps/api/src/common/api-exception.filter.ts:79`: the 500 branch logs the raw
  `originalUrl`, correlation text, and exception stack as an unstructured message.
- Actual installed Nest 11.1.28 registers the Express body parser before module
  middleware (`@nestjs/core/nest-application.js`). Thus these early failures do not
  establish nestjs-pino request AsyncLocalStorage. Nest's external-error mapping
  converts SyntaxError/URIError, but does not convert these body-parser HTTP errors.

Independent reproduction used actual installed Nest Test/LoggerModule, actual
`ApiExceptionFilter` and `crmHttpLogPrivacy`, a captured pino destination, and
Supertest. No mock logger/serializer and no database were involved. TypeScript
sources were transpiled in memory with installed TypeScript; no production,
dependency, configuration, or test files were changed for these probes.

1. Configure LoggerModule with `pinoHttp: [{...crmHttpLogPrivacy}, capturedStream]`.
2. Create the Nest application, install the real Pino Nest logger and global
   `new ApiExceptionFilter()`, and initialize. No controller is needed because
   the parser fails before routing.
3. Clear startup logs, send POST
   `/api/v1/crm/leads?search=ADVERSARIAL_PRIVATE_NEEDLE` with
   `Content-Type: application/json; charset=bogus` and body `{}`.
4. Observe HTTP 500 and one emitted `ApiExceptionFilter` log containing the
   protected query needle.
5. Repeat with `Content-Type: application/json` and JSON
   `{notes: "x".repeat(110000)}`. The default parser limit rejects it, again
   emitting the protected original URL in a 500 log.

Observed outputs:

```json
{"status":500,"logs":1,"containsProtectedQuery":true,"logContexts":["ApiExceptionFilter"]}
{"probe":"oversized","status":500,"logs":1,"containsProtectedQuery":true}
{"probe":"malformed","status":400,"logs":0,"containsProtectedQuery":false}
```

The malformed-JSON negative control confirms that SyntaxError mapping is different;
it is not being incorrectly reported as another leaking path. The attack requires
no authenticated session because it occurs before guards/controllers. An accidental
oversized CRM request with a protected search term also triggers the same leak.

Recommended repair: give every early CRM failure an explicit safe logging boundary
that does not depend solely on request AsyncLocalStorage. Preserve safe status,
correlation/resource identifiers and non-CRM diagnostics without forwarding raw
URL/query, parser payload, exception message/stack/cause, or free text. A controller
CRM exception filter alone cannot cover parser failures that occur before routing.
Do not broaden or weaken domain/authorization behavior to address logging.

Required acceptance tests: actual global-filter Nest requests for unsupported
charset/encoding, oversized JSON, malformed JSON, ordinary controller failures,
and an unaffected non-CRM error; inspect complete emitted log output for raw and
encoded contact/query needles, body/free text, cipher/HMAC and unsafe exception
metadata. Repeat against the integrated repair commit.

### Passing evidence and boundaries

- Independently reran existing `test/unit/crm-log-privacy.test.ts` on integration:
  7/7 PASS using installed Vitest 4.1.10. This covers normal request-scoped CRM
  errors, safe IDs/codes, selected route variants, and non-CRM referrer handling.
- Those tests manually emit errors from inside a controller and do not use the
  global exception filter or exercise the pre-middleware parser boundary.
- Nested arbitrary child logger bindings remain an additional test theme, not a
  confirmed production finding: no application use of `.assign()`/`.child()` was
  found in the reviewed committed API source.
- No final Phase 5.2 adversarial PASS, whole-phase finding-count assertion, or
  permission to start Phase 5.3 is implied. One HIGH remains open in this scope.
