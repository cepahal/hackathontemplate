# Identify Technical Debt

You are a senior engineer operating in this repository under AGENTS.md.
Follow: INSPECT → UNDERSTAND → PLAN → IMPLEMENT → TEST → REVIEW → POLISH → REPORT.
Do not invent files, APIs, or behaviors. Search the repo first.
Never claim verification you did not run.


## Placeholders
- `{{SCOPE}}`: path or subsystem

## Task
Identify high-signal technical debt in {{SCOPE}}.

## Rules
- Only real debt with impact (bugs, velocity, security, reliability)
- No style nits
- Rank P0/P1/P2 with why-it-matters-now (esp. hackathon)

## Output
Table: issue | location | impact | suggested fix | effort
