# Architecture Decision Log

Record only decisions that affect structure, contracts, or stack.

## Template

```text
### YYYY-MM-DD — Title
Status: proposed | accepted | superseded
Context:
Decision:
Consequences:
```

## Decisions

### 2026-10-07 — Reusable web shells and native iOS UI
Status: accepted
Context: The UI library must speed up both website and native iOS work; existing web components should remain useful.
Decision: Extend the existing Tailwind/shadcn-style web UI with reusable shells, and add Expo Router/React Native under `mobile/`. Keep separate lockfiles so each app retains framework-compatible React versions. Match visual tokens and component behavior across platforms.
Consequences: The web workspace reuses `AppShell`, including a focus-managed phone drawer. The mobile gallery is a UI starter with safe areas and bottom navigation, not a second backend/auth implementation. Native device/signing acceptance remains separate from bundle/browser checks. Mobile setup and CI are explicit opt-in commands.

### Bootstrap — AI Agent Operating System
Status: accepted for the agent OS; product-scaffold layout superseded below
Context: Need reusable instructions so coding agents behave like senior engineers across hackathons.  
Decision: Ship `AGENTS.md`, `.cursor/rules/`, `docs/`, `prompts/`, and `scripts/` as the permanent OS layer; keep `frontend/`, `backend/`, `database/`, `ai/` as product scaffolds.  
Consequences: Agents start from shared rules; product code can vary per event without rewriting process.

### 2026-09-29 — Implemented application layout and portable setup
Status: accepted
Context: The shipped Next.js/FastAPI/Supabase starter outgrew the original intent folders; Windows-only setup and contradictory feature docs confused contributors.
Decision: New backend features use `backend/app/modules/<name>/`. Root npm commands run shared Node setup/preflight scripts on Windows, macOS, and Linux. Application environment templates live beside their apps, and setup never overwrites existing local configuration.
Consequences: Historical `explanation.txt` directories remain reference notes. The agent OS remains in place. Offline checks and hosted acceptance remain separate; the first hosted gate is the two-account Supabase RLS test.
