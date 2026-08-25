# Task graph

| Node ID         | Wave | Task                                           | Owner   | Dependencies                                                  | Owned paths | Acceptance evidence | Status  |
| --------------- | ---- | ---------------------------------------------- | ------- | ------------------------------------------------------------- | ----------- | ------------------- | ------- |
| DOMAIN          | 1    | Approve domain contract                        | Agent 1 | Human approval                                                |             |                     | READY   |
| DATABASE        | 2    | Database contract/implementation               | Agent 2 | DOMAIN PASS                                                   |             |                     | BLOCKED |
| SECURITY        | 2    | Authorization contract/implementation          | Agent 3 | DOMAIN PASS                                                   |             |                     | BLOCKED |
| API             | 3    | Backend/API                                    | Agent 4 | DATABASE + SECURITY PASS                                      |             |                     | BLOCKED |
| UI              | 3    | Frontend/UI                                    | Agent 5 | API contract + upstream PASS                                  |             |                     | BLOCKED |
| SECURITY-REVIEW | 4    | Post-integration authorization/security review | Agent 3 | Integrated API candidate                                      |             |                     | BLOCKED |
| QA              | 4    | Independent automated QA                       | Agent 6 | Integrated candidate                                          |             |                     | BLOCKED |
| UX              | 4    | Responsive UX review                           | Agent 7 | Integrated frontend                                           |             |                     | BLOCKED |
| ADVERSARIAL     | 4    | Adversarial review                             | Agent 8 | Integrated candidate                                          |             |                     | BLOCKED |
| GOVERNANCE      | 5    | Release audit                                  | Agent 9 | SECURITY-REVIEW + QA + UX where applicable + ADVERSARIAL PASS |             |                     | BLOCKED |
| ROOT-GATE       | 5    | Final gate and STOP                            | Agent 0 | GOVERNANCE PASS                                               |             |                     | BLOCKED |

Legal transitions: BLOCKED→READY when dependencies PASS; READY→IN_PROGRESS on assignment; IN_PROGRESS→REVIEW with artifacts/evidence; REVIEW→PASS or FAILED; FAILED→READY after a routed repair plan. Root may reopen PASS only with a recorded reason and affected dependency reset.
