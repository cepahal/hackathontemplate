# AI, documents, vision, and agents

Implementation lives in `backend/app/modules/ai/`. Every endpoint requires a valid Supabase user Bearer token. Provider credentials stay on the backend. The adapters send real HTTP requests to OpenAI, Anthropic, and Gemini; tests replace those requests with fixtures. Live provider behavior and database policies require your accounts and have not been verified with real credentials.

## Configuration

Add the variables you need to `backend/.env` and restart the backend:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=
AI_TIMEOUT_SECONDS=45
AI_MAX_RETRIES=2
AI_PRICES_PER_MILLION={}
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Configure a model ID available to your account and supporting the requested capability. A request may override its provider's model. There is deliberately no assumed chat model default. Missing credentials/models return 503. Anthropic embeddings return 422 because this adapter does not offer them. Gemini embeddings use `gemini-embedding-001` when the direct embedding endpoint has no model override; for Gemini RAG, set both `EMBEDDING_PROVIDER=gemini` and `EMBEDDING_MODEL=gemini-embedding-001`.

| Adapter capability | OpenAI | Anthropic | Gemini |
| --- | --- | --- | --- |
| Text / real streamed text | Chat Completions / SSE | Messages / SSE | GenerateContent / SSE |
| Structured JSON | Strict JSON-schema response | Forced structured-response tool | JSON response schema |
| Image analysis + OCR-like text extraction | Image-capable model required | Vision-capable model required | Image-capable model required |
| 1536-dimensional embeddings | Supported embedding model | Unsupported explicitly | Supported embedding model |
| Structured-output streaming | Not exposed; use `/chat` | Not exposed; use `/chat` | Not exposed; use `/chat` |
| Audio/video generation, native web search, arbitrary tools | Not implemented | Not implemented | Not implemented |

Capabilities depend on the selected model's API support, not just the provider name. The agent uses application-side, schema-validated action dispatch; arbitrary provider-native tool definitions are not accepted from clients.

Usage includes reported input/output token counts. Unknown counts and prices remain `null`. To calculate a rough text-token estimate, set `AI_PRICES_PER_MILLION` to a JSON map such as `{"provider:your-model":{"input":2,"output":4}}`, replacing those illustrative numbers with your actual rates. Rates are USD per million tokens. This estimate is not a bill: discounts, cache rates, media pricing, and provider extras may differ. Anthropic cached-token requests do not receive an estimate. Usage is returned with responses and persisted in agent steps; this starter does not implement a billing ledger or distributed spending quota.

## Endpoints

All paths below start with `/api/v1/ai`.

| Method and path | Body / result |
| --- | --- |
| `POST /chat` | `{provider,model?,messages:[{role,content}],json_schema?,max_tokens?}` -> `{provider,model,text,structured,usage}` |
| `POST /chat/stream` | Same text request, without `json_schema`; real SSE `delta`, `done`, or `error` events |
| `POST /embeddings` | `{provider,model?,texts:["..."]}` -> 1536-dimensional vectors and usage |
| `POST /vision` | `{provider,model?,prompt,media_type,image_base64}` -> validated `{summary,detected_text,objects,uncertainties}` in `structured` |
| `POST /documents` | `{title,content,project_id?}` -> document ID, chunk count, embedding model, embedding usage |
| `GET /documents` | Up to 100 current user's document summaries, newest first |
| `DELETE /documents/{id}` | Deletes an owned document and its chunks |
| `POST /rag/query` | `{query,top_k?,project_id?,provider?,model?}` -> answer and retrieved source excerpts/citations |
| `POST /agents/runs` | `{goal,provider?,model?,max_steps?}` -> persisted bounded agent run |
| `GET /agents/runs` | Up to 50 current user's saved runs |
| `GET /agents/runs/{id}` | One owned run with steps, results, and pending approval |
| `POST /agents/runs/{id}/approve` | `{approve:true}` executes the saved proposal; `false` rejects it |

For structured chat, provide a provider-supported JSON schema; the backend validates the returned result as well. References and regex patterns are disallowed in public schemas. OpenAI uses strict structured output, Anthropic uses a forced `structured_response` tool, and Gemini uses JSON response configuration. Their accepted schema subsets differ: unsupported combinations fail clearly. The normal text endpoint accepts 30 messages with at most 60,000 total characters and 4,096 output tokens.

SSE frames look like this; JSON escaping preserves embedded line breaks:

```text
event: delta
data: {"delta":"Hello"}

event: done
data: {"provider":"openai","model":"your-model","usage":{"input_tokens":10,"output_tokens":2,"estimated_cost_usd":null}}

```

The backend retries transient HTTP statuses before streaming starts, never after partial output. Normal calls use bounded retries and timeouts. A failed generation may have been billed by the provider, including when a retry succeeds. After HTTP headers are sent, stream failures arrive as `event: error`, not a replacement HTTP status.

## Documents and citations

Apply `database/migrations/0001_core.sql` before using storage. It creates documents, chunks, the pgvector search RPC, and owner access policies. Storage calls use the signed-in user's JWT and public/anon API key, never a service-role key. Every direct table query also filters owner ID. A document linked to a project must belong to the same user.

Text ingestion supports up to 50,000 characters. It splits text into 1,800-character chunks with 200-character overlaps, embeds the chunks, and saves metadata containing title, chunk index, and exact provider/model. Search requests filter that model, so switching embedding providers requires re-ingestion. The database vector size is 1536. PDF parsing, binary document ingestion, and hybrid search are not included.

Answers are prompted to cite numbered retrieved excerpts. Returned citations contain actual stored excerpts and similarity scores; they do not prove that every generated statement is correct. Review the cited text. Document content is treated as untrusted data, and RAG never executes instructions from documents.

## Agent behavior and approval

The agent uses schema-validated decisions to call an allowlist of tools: `search_documents`, `project_summary`, and `create_project`, or finishes with an answer. It runs at most five model steps, keeps complete step results in `agent_runs`, and supplies a bounded summary of the latest three steps to the next model call. It cannot call arbitrary URLs, run code, send messages, or spend money through tools. Model generation itself uses the configured provider account.

`create_project` records exact proposed fields and enters `awaiting_approval`; it does not create anything yet. Approval requires the same authenticated owner, claims the pending state with a conditional database update, then writes a real project under that user's RLS permissions. A stable project UUID avoids duplicate creation after a recoverable uncertain network response. Rejection creates no project. Concurrent or repeated approvals return 409. If a process crashes while a run is `running`, inspect the recorded state and project UUID before recovering it; there is no background durable job worker or automatic crash recovery.

## Verification and extension points

From `backend`, run `.venv/Scripts/python.exe -m pytest tests/test_ai_providers.py tests/test_ai_workflows.py`. Tests cover provider normalization, retries, output validation, SSE termination/framing, image validation, embedding dimensions, chunking, ownership filtering, approval conflicts, rejection, and uncertain-write retries. Database isolation tests need a configured Supabase instance and two users; the mocked store tests do not establish that deployed RLS is correct. Servers remain off unless you explicitly start them.

Before production use, add distributed per-user rate/spending limits, a durable agent queue, document size quotas, observability, and model-specific integration tests. This is a working configurable starter, not a claim of completed production operations.

API references used for these adapters: [OpenAI Chat API](https://developers.openai.com/api/reference/resources/chat), [OpenAI embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create), [Claude streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [Claude tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview), [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision), [Gemini generation](https://ai.google.dev/api/generate-content), and [Gemini embeddings](https://ai.google.dev/api/embeddings).
