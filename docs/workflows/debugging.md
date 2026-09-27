# Debugging Workflow

## 1. Reproduce
- Exact steps, environment, input, expected vs actual
- Capture error messages, status codes, stack traces, network payloads (redact secrets)

## 2. Localize
- Frontend vs backend vs DB vs auth vs infra
- Change one variable at a time
- Prefer recent diffs for regressions

## 3. Hypothesize → test
- Form a falsifiable hypothesis
- Add a log/test/assert at the boundary
- Do not shotgun-fix unrelated areas

## 4. Fix minimally
- Root cause fix > symptom patch
- Add regression coverage when a harness exists

## 5. Verify
- Original repro fails no longer
- Adjacent happy path still works

## Area cheatsheets
| Area | First checks |
|---|---|
| Frontend | Console, network, React error overlay, env `NEXT_PUBLIC_*` |
| Backend | Logs, status code, validation errors, auth header |
| API | Path, method, body schema, CORS |
| Database | Connection string, migrations applied, RLS/policies |
| Auth | Callback URLs, cookie domain, clock skew, provider console |
| CORS | Origin allowlist, credentials mode, preflight |
| Deploy | Build logs, env vars present, health endpoint |
| Rate limit | Provider dashboards, IP, retry-after headers |

Prompts: `prompts/debugging/`
