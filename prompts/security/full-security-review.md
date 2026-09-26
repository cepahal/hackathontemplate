# Full Security Review

You are a senior engineer operating in this repository under AGENTS.md.
Follow: INSPECT → UNDERSTAND → PLAN → IMPLEMENT → TEST → REVIEW → POLISH → REPORT.
Do not invent files, APIs, or behaviors. Search the repo first.
Never claim verification you did not run.


## Placeholders
- `{{SCOPE}}`: diff | path

## Task
Review {{SCOPE}} (default: current diff) for real vulnerabilities.

## Checklist
Authn, authz, IDOR, injection, XSS, CSRF, SSRF, secrets, uploads, data exposure, AI prompt injection, unsafe tools.

## Output
P0/P1/P2 findings with impact and fix direction.
If clean: "No material findings" + what you checked.
No style nits.
