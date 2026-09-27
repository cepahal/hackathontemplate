# Feature: <replace with a short name>

Status: planned / in progress / verified

Owner: <name>

## User outcome

As <user>, I can <action> so that <specific result>.

Smallest complete workflow: <screen -> action -> API -> stored result, if any>.

In scope: <list concrete behaviors>.

Deferred: <list behaviors that will not be represented as working in this feature>.

## Data contract

Persistence: <none / chosen database and setup dependency>.

| Field | Type | Required/default | Validation | Who may read/change it? |
| --- | --- | --- | --- | --- |
| <field> | <type> | <rule> | <limits> | <ownership/role rule> |

- Record identity and uniqueness: <rules>.
- Relationships, deletion behavior, and indexes: <rules or not applicable>.
- Migration location and local test database: <paths/setup or not applicable>.
- Seed data: <synthetic examples only; no real credentials or personal records>.
- Authorization enforcement: <backend checks and database policies, if applicable>.

## API contract

| Item | Agreed value |
| --- | --- |
| Method and path | `<METHOD> /api/v1/<resource>` |
| Authentication | <none for public data, or exact token/session requirement> |
| Request | <JSON field names, types, constraints; use the data table above> |
| Success | <HTTP status and exact JSON shape> |
| Errors | <status codes and existing backend error shape> |
| Repeated request | <safe retry behavior; deduplication if it creates an external effect> |
| Timeouts and pagination | <bounds or not applicable> |

Add one synthetic request and response after replacing every placeholder. Keep the backend schema and frontend types consistent with this contract.

## UI behavior

- Initial and empty states: <what the user sees>.
- Loading and repeated clicks: <feedback and prevention of duplicate work>.
- Success: <visible result and whether it persists after reload>.
- Error and retry: <helpful user-facing message and recovery action>.
- Accessibility: <labels, keyboard operation, focus behavior, status announcements>.
- Narrow screens: <layout behavior>.

## Configuration and dependencies

- Required services/accounts: <list, or none>.
- Environment variables: <names and which process reads each; never paste values>.
- Browser-visible values: <explicitly public values only>.
- Missing configuration: <startup failure or disabled feature with a clear message>.
- Allowed origins/redirects: <exact local and deployment values, if relevant>.
- External failure behavior: <timeouts, rate limits, safe retries, or not applicable>.

## Sequential delivery ownership

Complete and review each work area before starting the next. Record its offline checks and any
hosted verification that needs an account; do not count an untested integration as verified.

| Work | Owner | Files owned | Depends on |
| --- | --- | --- | --- |
| UI and frontend types | <name> | <paths> | Agreed API contract |
| Backend and validation | <name> | <paths> | Agreed API/data contract |
| Database and access policies, if needed | <name> | <paths> | Agreed ownership rules |
| Integration and docs | <name> | <paths> | Completed implementations |

## Acceptance checks

- [ ] A new developer can follow the documented setup.
- [ ] The complete workflow succeeds with real configured dependencies.
- [ ] Invalid input produces the agreed error without changing stored data.
- [ ] Empty, loading, failure, and retry states are understandable.
- [ ] Any saved result survives a reload; local-only previews are labeled.
- [ ] If data is private, one user cannot read/change another user's record, including by calling the API directly.
- [ ] Missing credentials and unavailable services fail clearly without revealing secrets.
- [ ] Retries cannot duplicate charges or other non-idempotent effects, if applicable.
- [ ] Relevant lint/type/build checks and behavior tests pass.
- [ ] Documentation states which dependencies and workflows were actually tested.

## Verification record

Date: <date>

Commands and outcome: <commands plus pass/fail>

Manual workflow: <steps and observed result>

Remaining limitations: <known gaps, untested integrations, or none>
