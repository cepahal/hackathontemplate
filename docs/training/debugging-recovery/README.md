# Debugging & Recovery Lead — Training Program

You are training to be the team's **primary debugging and recovery engineer** during hackathons.

AI writes fast. You keep the demo alive.

## How this program works

1. Learn the **mental models** in this folder (not command trivia)
2. Run **drills** with incomplete evidence — ask for what you need
3. Practice **AI supervision**: FACT / HYPOTHESIS / CONFIRMED
4. Graduate when you can triage a live incident in under ~10 minutes to a safe next step

## Curriculum map

| Module | File | Outcome |
|---|---|---|
| Mental model | `00-mental-model.md` | Symptom ≠ cause; evidence-first loop |
| Git mastery | `01-git-mastery.md` | What each tool changes; safe vs destructive |
| Git recovery | `02-git-recovery-scenarios.md` | A–H playbooks with loss warnings |
| Browser | `03-browser-devtools.md` | Network/Console/App triage |
| Backend | `04-backend-debugging.md` | Stack traces → boundary → cause |
| Database | `05-database-debugging.md` | App → SQL → DB → result → app |
| Environment | `06-environment-debugging.md` | Env/CORS/URL/secrets |
| External APIs | `07-rate-limits-external-apis.md` | 429/timeouts before code churn |
| AI supervision | `08-ai-assisted-debugging.md` | Force disciplined AI debugging |
| Decision trees | `cheatsheets/` | Fast lookup under pressure |
| Drills | `drills/` | Beginner → Hackathon Incident |

## Mastery standard

Given an error, stack trace, network request, git diff, SQL, or log, you can state:

1. Where the failure boundary is (or what evidence is missing)
2. Top 2–3 likely causes ranked by evidence
3. Safest next diagnostic step (not a speculative rewrite)
4. Recovery option if the change was AI-inflicted
5. How you will verify the fix

## Training rules (mentor + student)

- You propose the next command/check **before** running it
- You label statements: **FACT** / **HYPOTHESIS** / **CONFIRMED**
- You never accept an AI fix that touches many files without a root cause
- Destructive git ops require stating **what will be lost** first

## Start here

Open `00-mental-model.md`, then begin `drills/beginner/01-status-and-diff.md` with your mentor (this chat).

Agent prompt for AI helpers: `prompts/debugging/evidence-first-debug.md`
