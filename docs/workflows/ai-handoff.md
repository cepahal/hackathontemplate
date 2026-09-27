# AI Agent Handoff Workflow

When pausing or switching agents:

1. Ensure the working tree is understandable (`git status`, summarize diff)
2. Fill `docs/templates/handoff.md`
3. Point to failing tests / open questions
4. Do not leave half-applied migrations undocumented

Incoming agent must:
1. Read handoff + `AGENTS.md`
2. Re-inspect cited files (do not trust summary blindly)
3. Continue the operating loop from INSPECT
