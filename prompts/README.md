# Prompt Library

Reusable prompts for coding agents (Cursor, Codex, Claude Code, etc.).

## How to use
1. Pick the category that matches your task.
2. Open the prompt file.
3. Paste into the agent chat.
4. Fill in `{{PLACEHOLDERS}}` if present.
5. The agent must still follow `AGENTS.md` (inspect → verify → report).

## Categories
| Folder | Use for |
|---|---|
| `codebase/` | Orientation, tracing, locating code |
| `architecture/` | Design and structural review |
| `features/` | Building and extending features |
| `frontend/` `backend/` `database/` `ai/` | Layer-specific work |
| `debugging/` | Failure localization and fixes |
| `testing/` | Tests and failure diagnosis |
| `refactoring/` | Safe structural improvement |
| `security/` | Threat-focused review |
| `performance/` | Latency, cost, hot paths |
| `deployment/` | Prod readiness and smoke |
| `git/` | Branching, commits, conflict help |
| `code-review/` | Post-change review |
| `ui/` | Polish, a11y, states |
| `hackathon/` | Time-boxed execution |

## Quality bar for prompts
Every prompt should push the agent to: inspect evidence, minimize change, verify, and report honestly.
