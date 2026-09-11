# Remediation log

| Finding ID | Routed owner | Approved paths | Repair branch/SHA | Tests | Independent re-review | Result |
| ---------- | ------------ | -------------- | ----------------- | ----- | --------------------- | ------ |
| P502-DB-001 | Database | NEW migration; database CRM tests; database contract | source9f82b62; integrated0cfed0b | Fresh16; upgrade15-to16; seed twice both; DB29/29; integration26/26; Root rerun26/26 | Security exact-commit review approved database scope; Root verified | CLOSED database scope; final cumulative regression still required |
| P502-AUTH-001 | Security then API | Authorization contract; API contract/services after DB gate | pending | Same-Branch read conjunction; totals/cursors; mutation disclosure | Security after integration | OPEN HIGH |
| P502-SEC-002 | Security | AppModule logging configuration; new common CRM log privacy utility; focused unit tests | source59bf377; integrated6891cde | Real emitted-log7/7; API unit56/56; tsc/lint/format/check; Root integrated7/7 | Independent scoped adversarial recheck dispatched; final integrated QA still required | OPEN HIGH pending recheck |
