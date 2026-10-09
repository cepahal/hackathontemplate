# app/ai — AI application layer

Real provider calls (OpenAI, Gemini, Anthropic, xAI Grok) behind one service, with validated
structured output, SSE streaming, file/image input and per-user history. Keys stay on the server;
tests mock HTTP only.

```text
Frontend ─▶ /api/v1/ai/* (modules/ai/router.py: auth, rate limit, multipart, body-size limit)
         ─▶ AIService (service.py: size checks, provider choice, versioned prompt, history)
         ─▶ AIProvider adapter (providers/*.py, built on app/integrations/ai clients)
         ─▶ LLM HTTP API (HttpClient: fixed base URL, retries, timeouts, redacted logs)
         ─▶ validation (Pydantic for JSON, strict event parsing for streams)
         ─▶ ai_generations row (history.py, caller's JWT → RLS) ─▶ typed response / SSE
```

| File | Role |
|---|---|
| `service.py` | `AIService.generate_text / generate_structured / start_stream / analyze_image / analyze_file / history` |
| `providers/base.py` | `AIProvider` = `AIClient` + `stream_text()` + `analyze_image()` + `supported_attachments` |
| `providers/openai.py` | OpenAI + Grok (Chat Completions SSE, `image_url` / `file` parts) |
| `providers/gemini.py` | `streamGenerateContent?alt=sse`, `inlineData` parts |
| `providers/anthropic.py` | Messages API SSE events, `image` / `document` blocks |
| `structured.py` | `STRUCTURED_TASKS` registry + `generate_validated()` (one corrective retry) |
| `schemas.py` | `GeneratedPlan`, results, history record, stream events |
| `prompts.py` | Versioned `PromptTemplate`s; user text wrapped in data tags |
| `streaming.py` | SSE parser (inbound), encoder/response (outbound), overall deadline |
| `files.py` | Upload validation: filename, size, extension allowlist, magic bytes, UTF-8, PDF checks |
| `history.py` | `ai_generations` repository (always filtered by `user_id`, plus RLS) |

## Provider selection

The client may name a provider (`openai | gemini | anthropic | grok`); it must be configured or the
request fails with 503 `INTEGRATION_NOT_CONFIGURED`. Models are **never** client-chosen — they come
from `*_MODEL` settings. Default: `AI_DEFAULT_PROVIDER`, else the first configured provider that
supports the input type (e.g. Grok is skipped for PDFs).

## Structured output

`prompt → provider JSON-schema mode → raw JSON → Pydantic (extra="forbid", bounds, enums)`.
Invalid JSON or schema violations get one retry with a corrective system note, then fail with
502 `AI_INVALID_STRUCTURED_OUTPUT` (recorded as `failed`; nothing invalid is returned or stored as a
result). Add a schema: define a model in `schemas.py`, a prompt in `prompts.py`, register it in
`STRUCTURED_TASKS` and add the name to `StructuredSchemaName`.

## Streaming

`POST /ai/stream` validates input and inserts a `pending` row **before** streaming, so validation
and configuration errors are normal HTTP errors. Then:

```text
event: start  data: {"id","provider","model"}
event: delta  data: {"text"}            (repeated)
event: done   data: {"id","finish_reason","usage"}   — or —   event: error data: {"code","message"}
```

- Upstream: retries only before the first byte; per-read timeout + overall `AI_STREAM_TIMEOUT_SECONDS`.
- Each provider must send its completion marker (`[DONE]`, `finishReason`, `message_stop`), else
  `AI_STREAM_INCOMPLETE`; unparsable events → `AI_MALFORMED_STREAM`; provider error events map to
  the usual `INTEGRATION_*` codes.
- Client disconnect → the generator is closed and the row is finalised as `cancelled` (shielded
  from cancellation). Partial text is kept in `output.text`.

## Files and images

`POST /ai/analyze-image` (images) and `POST /ai/analyze-file` (TXT/MD, PDF, images), multipart.
The client's Content-Type and the extension alone are never trusted: content must match the
extension by magic bytes (text must be strict UTF-8 without control characters). PDFs must have a
valid header and `%%EOF`, and encrypted PDFs are refused. PDFs and images go to providers natively;
text files become prompt context. Only file metadata (name, type, size, sha256) is stored.

`analyze_image(attachment, prompt)` is generic: OCR, description, document analysis or
classification are just different prompts (see `IMAGE_ANALYSIS_V1`, `DOCUMENT_ANALYSIS_V1`).

## Limits and security

| Setting | Default | Effect |
|---|---|---|
| `AI_MAX_PROMPT_CHARS` | 20 000 | 413 `PROMPT_TOO_LARGE` |
| `AI_MAX_CONTEXT_CHARS` | 50 000 | 413 `CONTEXT_TOO_LARGE`; also caps text-file length |
| `AI_MAX_FILE_BYTES` | 5 MiB | 413 `FILE_TOO_LARGE` |
| `AI_MAX_OUTPUT_TOKENS` | 2048 | sent to every provider |
| `AI_STREAM_TIMEOUT_SECONDS` | 120 | overall stream deadline → `INTEGRATION_TIMEOUT` |
| `INTEGRATIONS_RATE_LIMIT_PER_MINUTE` | 20 | per-user limit shared with integration routes → 429 |

- `BodySizeLimitMiddleware` rejects oversized `/api/v1/ai/*` bodies (and bodies without
  `Content-Length`, 411) before they are read.
- Prompts: user input/context are wrapped in `<user_input>` / `<context>`, closing tags inside user
  text are neutralised, and the system prompt says tagged text is data. Model output is treated as
  untrusted: validated (structured) or rendered as text (the frontend never interprets HTML).
- Provider error bodies are not echoed to clients; logs never include keys, headers or prompts.
