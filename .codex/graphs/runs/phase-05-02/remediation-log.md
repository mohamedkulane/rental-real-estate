# Remediation log

| Finding ID | Routed owner | Approved paths | Repair branch/SHA | Tests | Independent re-review | Result |
| ---------- | ------------ | -------------- | ----------------- | ----- | --------------------- | ------ |
| P502-DB-001 | Database | NEW migration; database CRM tests; database contract | source9f82b62; integrated0cfed0b | Fresh16; upgrade15-to16; seed twice both; DB29/29; integration26/26; Root rerun26/26 | Security exact-commit review approved database scope; Root verified | CLOSED database scope; final cumulative regression still required |
| P502-AUTH-001 | Security then API | Authorization contract; API contract/services after DB gate | pending | Same-Branch read conjunction; totals/cursors; mutation disclosure | Security after integration | OPEN HIGH |
| P502-SEC-002 | Security | AppModule logging configuration; new common CRM log privacy utility; focused unit tests | pending | Actual emitted request/response/error logs exclude CRM protected URL/query/contact/free text | Independent QA/adversarial after integration | OPEN HIGH |
