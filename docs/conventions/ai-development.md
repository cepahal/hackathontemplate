# AI Development Conventions

## Architecture
```text
UI → FastAPI route → AIService (app/ai) → provider adapter → provider HTTP API
```

Keep provider SDKs out of UI components.

## Structured output
- Define a schema
- Validate model output before use
- Retry once on parse failure; then fail safely

## Safety
- Separate system instructions from user content
- Do not grant tools that can exfiltrate secrets based on user text alone
- Rate-limit and timeout all provider calls

## Cost / latency
- Cache embeddings when identical inputs repeat
- Stream only when UX needs it
- Log token usage when the project already tracks metrics
