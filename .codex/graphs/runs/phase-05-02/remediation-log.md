# Remediation log

| Finding ID | Routed owner | Approved paths | Repair branch/SHA | Tests | Independent re-review | Result |
| ---------- | ------------ | -------------- | ----------------- | ----- | --------------------- | ------ |
| P502-DB-001 | Database | NEW migration; database CRM tests; database contract | codex/p5-02-database / pending | Historical Branch/employee outcomes/reschedule/terminal closure; insert/immutability negatives; fresh/upgrade/seed twice | Security pending repair | OPEN HIGH; upstream reopened |
| P502-AUTH-001 | Security then API | Authorization contract; API contract/services after DB gate | pending | Same-Branch read conjunction; totals/cursors; mutation disclosure | Security after integration | OPEN HIGH |
