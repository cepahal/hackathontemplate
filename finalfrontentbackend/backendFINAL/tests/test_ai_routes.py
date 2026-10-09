"""/api/v1/ai/* end to end through FastAPI with mocked provider HTTP and the in-memory DB:
auth, provider selection rules, persistence (completed/failed/cancelled), SSE, size limits,
multipart uploads, history isolation and rate limiting."""

import json
from collections.abc import Callable, Iterator
from typing import Any, cast

import httpx
import pytest
from fastapi.testclient import TestClient

from app.ai.history import AIHistoryRepository
from app.ai.schemas import StreamStarted
from app.ai.service import AIService
from app.core.security import AuthenticatedUser
from app.integrations.registry import Integrations
from tests.conftest import ALICE_ID, BOB_ID, build_settings
from tests.fakes import InMemoryDB
from tests.mock_api import MockApi
from tests.test_ai_files import PDF, PNG
from tests.test_ai_providers import VALID_PLAN, openai_chunk, openai_reply, sse

pytestmark = pytest.mark.usefixtures("instant_retries")

ClientFactory = Callable[..., TestClient]
OPENAI_KEY = "sk-test-ai-route-key-123456"
AI = "/api/v1/ai"


class Harness:
    def __init__(self, client_factory: ClientFactory, api: MockApi, **settings: object) -> None:
        self.api = api
        self.db = InMemoryDB()
        self.db.add_profile(ALICE_ID, "alice@example.com")
        self.db.add_profile(BOB_ID, "bob@example.com")
        self.settings = build_settings(**{"openai_api_key": OPENAI_KEY, **settings})
        self.client = client_factory(self.db, self.settings, Integrations(self.settings, api.client()))

    @property
    def rows(self) -> list[dict[str, Any]]:
        return cast(list[dict[str, Any]], self.db.tables["ai_generations"])


@pytest.fixture
def make(client_factory: ClientFactory) -> Callable[..., Harness]:
    def factory(*replies: httpx.Response | Exception, **settings: object) -> Harness:
        return Harness(client_factory, MockApi(*replies), **settings)

    return factory


def sse_events(text: str) -> list[tuple[str, dict[str, object]]]:
    events = []
    for block in text.strip().split("\n\n"):
        fields = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((fields["event"], json.loads(fields["data"])))
    return events


# --- auth + validation ----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/providers"),
        ("POST", "/generate"),
        ("POST", "/structured"),
        ("POST", "/stream"),
        ("POST", "/analyze-image"),
        ("POST", "/analyze-file"),
        ("GET", "/history"),
    ],
)
def test_every_ai_route_requires_auth(client: TestClient, method: str, path: str) -> None:
    kwargs = {"json": {"prompt": "hi"}} if method == "POST" else {}
    response = client.request(method, f"{AI}{path}", **kwargs)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_forged_token_is_rejected(client: TestClient) -> None:
    response = client.post(f"{AI}/generate", json={"prompt": "hi"}, headers={"Authorization": "Bearer abc.def.ghi"})
    assert response.status_code == 401


@pytest.mark.parametrize(
    "body",
    [
        {"prompt": "hi", "model": "gpt-4o"},  # clients can never pick a model
        {"prompt": "hi", "provider": "llama-local"},  # only known provider names
        {"prompt": "   "},
        {"prompt": ""},
        {},
    ],
)
def test_request_validation(make: Callable[..., Harness], alice: dict[str, str], body: dict[str, object]) -> None:
    h = make()
    response = h.client.post(f"{AI}/generate", json=body, headers=alice)
    assert response.status_code == 422
    assert h.api.requests == []


def test_unconfigured_provider_cannot_be_selected(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make()
    response = h.client.post(f"{AI}/generate", json={"prompt": "hi", "provider": "anthropic"}, headers=alice)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "INTEGRATION_NOT_CONFIGURED"
    assert h.api.requests == []


def test_no_ai_key_at_all(client: TestClient, alice: dict[str, str]) -> None:
    response = client.post(f"{AI}/generate", json={"prompt": "hi"}, headers=alice)
    assert response.status_code == 503
    assert response.json()["error"]["details"]["env_var"].startswith("OPENAI_API_KEY")


def test_providers_lists_configuration_without_secrets(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make()
    response = h.client.get(f"{AI}/providers", headers=alice)
    assert response.status_code == 200
    by_name = {p["name"]: p for p in response.json()}
    assert by_name["openai"]["configured"] is True and by_name["openai"]["default"] is True
    assert by_name["gemini"]["configured"] is False
    assert "application/pdf" in by_name["openai"]["attachments"]
    assert OPENAI_KEY not in response.text


# --- size limits ------------------------------------------------------------------------------


def test_oversized_body_rejected_before_parsing(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make()
    huge = "x" * (h.settings.ai_max_prompt_chars + h.settings.ai_max_context_chars) * 5
    response = h.client.post(f"{AI}/generate", json={"prompt": huge}, headers=alice)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert response.headers["x-request-id"]
    assert h.api.requests == []


def test_oversized_upload_rejected_before_parsing(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(ai_max_file_bytes=2048)
    response = h.client.post(
        f"{AI}/analyze-image",
        headers=alice,
        files={"file": ("big.png", PNG + b"\x00" * 200_000)},
        data={"prompt": "Describe"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_body_without_content_length_is_refused(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make()

    def chunks() -> Iterator[bytes]:
        yield b'{"prompt": "hi"}'

    response = h.client.post(f"{AI}/generate", content=chunks(), headers={**alice, "Content-Type": "application/json"})
    assert response.status_code == 411


def test_prompt_over_configured_limit(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(ai_max_prompt_chars=100)
    response = h.client.post(f"{AI}/generate", json={"prompt": "x" * 101}, headers=alice)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PROMPT_TOO_LARGE"
    assert h.api.requests == []


# --- generate ---------------------------------------------------------------------------------


def test_generate_calls_provider_and_persists(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(openai_reply("Hello Alice"))
    response = h.client.post(f"{AI}/generate", json={"prompt": "Greet me", "context": "Name: Alice"}, headers=alice)

    assert response.status_code == 200
    body = response.json()
    assert body["text"] == "Hello Alice" and body["provider"] == "openai" and body["model"] == "gpt-test"

    sent = h.api.body()
    assert sent["max_completion_tokens"] == h.settings.ai_max_output_tokens
    user_message = sent["messages"][-1]["content"]
    assert "<user_input>\nGreet me\n</user_input>" in user_message and "Name: Alice" in user_message

    [row] = h.rows
    assert row["id"] == body["id"] and row["user_id"] == str(ALICE_ID)
    assert (row["type"], row["status"]) == ("text", "completed")
    assert row["input"]["prompt"] == "Greet me" and row["input"]["prompt_id"] == "assistant.v1"
    assert row["output"]["text"] == "Hello Alice"


def test_provider_failure_returns_502_and_records_failure(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(httpx.Response(500, json={"error": {"message": f"upstream broke {OPENAI_KEY}"}}))
    response = h.client.post(f"{AI}/generate", json={"prompt": "hi"}, headers=alice)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "INTEGRATION_UNAVAILABLE"
    assert OPENAI_KEY not in response.text
    [row] = h.rows
    assert row["status"] == "failed" and row["output"]["error"]["code"] == "INTEGRATION_UNAVAILABLE"


def test_provider_timeout_returns_504(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(httpx.ReadTimeout("slow"))
    response = h.client.post(f"{AI}/generate", json={"prompt": "hi"}, headers=alice)
    assert response.status_code == 504


def test_rate_limit_applies_per_user(make: Callable[..., Harness], alice: dict[str, str], bob: dict[str, str]) -> None:
    h = make(openai_reply("ok"), integrations_rate_limit_per_minute=1)
    assert h.client.post(f"{AI}/generate", json={"prompt": "hi"}, headers=alice).status_code == 200
    limited = h.client.post(f"{AI}/generate", json={"prompt": "hi"}, headers=alice)
    assert limited.status_code == 429 and "retry-after" in limited.headers
    assert h.client.post(f"{AI}/generate", json={"prompt": "hi"}, headers=bob).status_code == 200


# --- structured -------------------------------------------------------------------------------


def test_structured_returns_validated_plan(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(openai_reply(json.dumps(VALID_PLAN)))
    response = h.client.post(f"{AI}/structured", json={"prompt": "Plan my demo"}, headers=alice)

    assert response.status_code == 200
    body = response.json()
    assert body["schema_name"] == "generated_plan" and body["data"] == VALID_PLAN
    [row] = h.rows
    assert row["type"] == "structured" and row["output"] == {"data": VALID_PLAN}


def test_structured_malformed_json_twice_fails_cleanly(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(openai_reply('{"title": "unterminated'))
    response = h.client.post(f"{AI}/structured", json={"prompt": "Plan my demo"}, headers=alice)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "AI_INVALID_STRUCTURED_OUTPUT"
    assert len(h.api.requests) == 2
    [row] = h.rows
    assert row["status"] == "failed" and "data" not in (row["output"] or {})


def test_structured_rejects_unknown_schema(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make()
    response = h.client.post(f"{AI}/structured", json={"prompt": "x", "output_schema": "Any"}, headers=alice)
    assert response.status_code == 422


# --- streaming --------------------------------------------------------------------------------


def test_stream_sends_start_deltas_done_and_persists(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(sse(openai_chunk("Hel"), openai_chunk("lo", "stop"), "[DONE]"))
    response = h.client.post(f"{AI}/stream", json={"prompt": "Say hello"}, headers=alice)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"].startswith("no-cache")
    events = sse_events(response.text)
    assert [name for name, _ in events] == ["start", "delta", "delta", "done"]
    assert events[0][1]["provider"] == "openai"
    assert "".join(str(data["text"]) for name, data in events if name == "delta") == "Hello"
    assert events[-1][1]["finish_reason"] == "stop"

    [row] = h.rows
    assert row["id"] == events[0][1]["id"] == events[-1][1]["id"]
    assert (row["type"], row["status"]) == ("stream", "completed")
    assert row["output"]["text"] == "Hello"


def test_stream_failure_mid_way_ends_with_error_event(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(sse(openai_chunk("Partial"), "{broken"))
    response = h.client.post(f"{AI}/stream", json={"prompt": "hi"}, headers=alice)

    events = sse_events(response.text)
    assert [name for name, _ in events] == ["start", "delta", "error"]
    assert events[-1][1]["code"] == "AI_MALFORMED_STREAM"
    [row] = h.rows
    assert row["status"] == "failed"
    assert row["output"]["text"] == "Partial"
    assert row["output"]["error"]["code"] == "AI_MALFORMED_STREAM"


def test_stream_upstream_rejection_is_an_error_event(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(httpx.Response(401, json={"error": {"message": "invalid key"}}))
    events = sse_events(h.client.post(f"{AI}/stream", json={"prompt": "hi"}, headers=alice).text)
    assert [name for name, _ in events] == ["start", "error"]
    assert events[-1][1]["code"] == "INTEGRATION_AUTH_FAILED"


def test_stream_validation_errors_are_plain_http_errors(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(ai_max_prompt_chars=100)
    response = h.client.post(f"{AI}/stream", json={"prompt": "x" * 101}, headers=alice)
    assert response.status_code == 413
    assert h.rows == []


async def test_abandoned_stream_is_recorded_as_cancelled() -> None:
    api = MockApi(sse(openai_chunk("one"), openai_chunk("two", "stop"), "[DONE]"))
    settings = build_settings(openai_api_key=OPENAI_KEY)
    db = InMemoryDB()
    user = AuthenticatedUser(id=ALICE_ID, email="alice@example.com", role="user", session_id=None, access_token="t")
    service = AIService(Integrations(settings, api.client()), AIHistoryRepository(db, user), settings)

    session = await service.start_stream("hi")
    events = session.events()
    assert isinstance(await anext(events), StreamStarted)
    assert db.tables["ai_generations"][0]["status"] == "pending"
    await events.aclose()  # what StreamingResponse does when the client disconnects

    row = db.tables["ai_generations"][0]
    assert row["status"] == "cancelled"
    assert row["output"] == {"text": "", "finish_reason": None, "usage": None}


# --- image + file analysis ------------------------------------------------------------------


def test_analyze_image_multipart(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(openai_reply("A red square"))
    response = h.client.post(
        f"{AI}/analyze-image",
        headers=alice,
        files={"file": ("../../red.png", PNG, "text/plain")},  # client content type is ignored
        data={"prompt": "Describe it"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["text"] == "A red square"
    part = h.api.body()["messages"][-1]["content"][1]
    assert part["image_url"]["url"].startswith("data:image/png;base64,")
    [row] = h.rows
    assert row["type"] == "image"
    file_info = row["input"]["file"]
    assert file_info["filename"] == "red.png" and file_info["media_type"] == "image/png"
    assert "data" not in file_info


@pytest.mark.parametrize(
    ("filename", "content", "status", "code"),
    [
        ("evil.png", b"<script>alert(1)</script>", 400, "FILE_TYPE_MISMATCH"),
        ("doc.pdf", PDF, 415, "FILE_TYPE_UNSUPPORTED"),
        ("run.exe", b"MZ\x90\x00", 415, "FILE_TYPE_UNSUPPORTED"),
        ("empty.png", b"", 400, "FILE_EMPTY"),
        ("big.png", PNG + b"\x00" * 4096, 413, "FILE_TOO_LARGE"),
    ],
)
def test_analyze_image_rejects_bad_files(
    make: Callable[..., Harness], alice: dict[str, str], filename: str, content: bytes, status: int, code: str
) -> None:
    h = make(ai_max_file_bytes=2048)
    response = h.client.post(
        f"{AI}/analyze-image", headers=alice, files={"file": (filename, content)}, data={"prompt": "Describe"}
    )
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert h.api.requests == []


def test_analyze_image_requires_prompt(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make()
    response = h.client.post(f"{AI}/analyze-image", headers=alice, files={"file": ("a.png", PNG)}, data={"prompt": " "})
    assert response.status_code == 422


def test_analyze_file_text_becomes_context(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(openai_reply("It's about llamas"))
    response = h.client.post(
        f"{AI}/analyze-file",
        headers=alice,
        files={"file": ("notes.txt", b"Llamas are great.\nThey hum.")},
        data={"prompt": "What is this about?"},
    )
    assert response.status_code == 200
    user_message = h.api.body()["messages"][-1]["content"]
    assert "Llamas are great." in user_message and "<context>" in user_message
    assert h.rows[0]["type"] == "file"


def test_analyze_file_pdf_goes_to_provider_natively(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(openai_reply("Summary"))
    response = h.client.post(
        f"{AI}/analyze-file", headers=alice, files={"file": ("doc.pdf", PDF)}, data={"prompt": "Summarise"}
    )
    assert response.status_code == 200
    assert h.api.body()["messages"][-1]["content"][1]["type"] == "file"


def test_provider_that_cannot_read_pdf_is_refused(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(grok_api_key="xai-test-key-123456")
    response = h.client.post(
        f"{AI}/analyze-file",
        headers=alice,
        files={"file": ("doc.pdf", PDF)},
        data={"prompt": "Summarise", "provider": "grok"},
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "PROVIDER_UNSUPPORTED_INPUT"


# --- history ----------------------------------------------------------------------------------


def test_history_is_isolated_per_user(make: Callable[..., Harness], alice: dict[str, str], bob: dict[str, str]) -> None:
    h = make(openai_reply("for alice"))
    h.client.post(f"{AI}/generate", json={"prompt": "alice secret"}, headers=alice)
    h.client.post(f"{AI}/generate", json={"prompt": "alice again"}, headers=alice)

    alice_history = h.client.get(f"{AI}/history", headers=alice).json()
    bob_history = h.client.get(f"{AI}/history", headers=bob)

    assert [r["input"]["prompt"] for r in alice_history] == ["alice again", "alice secret"]
    assert bob_history.status_code == 200 and bob_history.json() == []
    # The fake DB has no RLS, so this proves the repository filters by user itself.
    last_select = [call for call in h.db.calls if call[0] == "select"][-1]
    assert last_select[2]["user_id"] == BOB_ID


def test_history_filters_and_paginates(make: Callable[..., Harness], alice: dict[str, str]) -> None:
    h = make(openai_reply("ok"))
    for prompt in ("one", "two", "three"):
        h.client.post(f"{AI}/generate", json={"prompt": prompt}, headers=alice)

    page = h.client.get(f"{AI}/history", params={"limit": 2, "offset": 1}, headers=alice).json()
    assert [r["input"]["prompt"] for r in page] == ["two", "one"]
    assert h.client.get(f"{AI}/history", params={"type": "stream"}, headers=alice).json() == []
    assert h.client.get(f"{AI}/history", params={"limit": 1000}, headers=alice).status_code == 422
    assert h.client.get(f"{AI}/history", params={"type": "secret"}, headers=alice).status_code == 422
