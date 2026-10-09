"""AI adapters: request shape per provider, text + structured output, and failure modes."""

import json

import httpx
import pytest
from pydantic import BaseModel, SecretStr

from app.integrations.ai.anthropic_client import AnthropicClient
from app.integrations.ai.base import AIClient, ChatMessage, json_schema_for, parse_structured
from app.integrations.ai.gemini_client import GeminiClient
from app.integrations.ai.openai_client import GrokClient, OpenAIClient
from app.integrations.errors import (
    IntegrationInvalidResponseError,
    IntegrationNotConfiguredError,
    IntegrationTimeoutError,
)
from tests.mock_api import MockApi

pytestmark = pytest.mark.usefixtures("instant_retries")

KEY = SecretStr("test-key-123")


class Address(BaseModel):
    city: str
    country: str


class Person(BaseModel):
    name: str
    age: int
    address: Address


PERSON = {"name": "Ada", "age": 36, "address": {"city": "London", "country": "UK"}}


def openai_reply(content: str | None, *, refusal: str | None = None, finish: str = "stop") -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "model": "gpt-test-2026",
            "choices": [{"message": {"content": content, "refusal": refusal}, "finish_reason": finish}],
            "usage": {"prompt_tokens": 11, "completion_tokens": 3},
        },
    )


def gemini_reply(*parts: dict[str, object], finish: str = "STOP") -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "candidates": [{"content": {"parts": list(parts)}, "finishReason": finish}],
            "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 2},
            "modelVersion": "gemini-test",
        },
    )


def anthropic_reply(*content: dict[str, object], stop: str = "end_turn") -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "model": "claude-test",
            "content": list(content),
            "stop_reason": stop,
            "usage": {"input_tokens": 9, "output_tokens": 4},
        },
    )


# --- OpenAI / Grok -----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("client_type", "base_url"), [(OpenAIClient, "https://api.openai.com/v1"), (GrokClient, "https://api.x.ai/v1")]
)
async def test_openai_compatible_generate_text(client_type: type[OpenAIClient], base_url: str) -> None:
    api = MockApi(openai_reply("Hello!"))
    client = client_type(api.client(), KEY, default_model="default-model")

    result = await client.generate_text("Say hi", system="Be brief", max_tokens=50, temperature=0.2)

    assert result.text == "Hello!"
    assert result.model == "gpt-test-2026"
    assert result.provider == client.service_name
    assert result.finish_reason == "stop"
    assert result.usage is not None and (result.usage.input_tokens, result.usage.output_tokens) == (11, 3)
    assert str(api.last.url) == f"{base_url}/chat/completions"
    assert api.last.headers["Authorization"] == "Bearer test-key-123"
    assert api.body() == {
        "model": "default-model",
        "messages": [{"role": "system", "content": "Be brief"}, {"role": "user", "content": "Say hi"}],
        "max_completion_tokens": 50,
        "temperature": 0.2,
    }


async def test_openai_multi_turn_prompt_and_model_override() -> None:
    api = MockApi(openai_reply("4"))
    client = OpenAIClient(api.client(), KEY, default_model="default-model")
    history = [
        ChatMessage(role="user", content="2+2?"),
        ChatMessage(role="assistant", content="4"),
        ChatMessage(role="user", content="Again?"),
    ]

    await client.generate_text(history, model="other-model")

    body = api.body()
    assert body["model"] == "other-model"
    assert body["messages"] == [m.model_dump() for m in history]
    assert "temperature" not in body


async def test_openai_structured_output_sends_schema_and_validates() -> None:
    api = MockApi(openai_reply(json.dumps(PERSON)))
    client = OpenAIClient(api.client(), KEY, default_model="m")

    person = await client.generate_structured("Describe Ada", Person)

    assert person == Person.model_validate(PERSON)
    response_format = api.body()["response_format"]
    assert isinstance(response_format, dict)
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["name"] == "Person"
    assert "$defs" not in json.dumps(response_format)


async def test_openai_structured_output_that_does_not_match_schema() -> None:
    api = MockApi(openai_reply('{"name": "Ada"}'))
    with pytest.raises(IntegrationInvalidResponseError) as exc_info:
        await OpenAIClient(api.client(), KEY, default_model="m").generate_structured("x", Person)
    assert exc_info.value.code == "AI_INVALID_STRUCTURED_OUTPUT"


async def test_openai_refusal() -> None:
    api = MockApi(openai_reply(None, refusal="I can't help with that"))
    with pytest.raises(IntegrationInvalidResponseError) as exc_info:
        await OpenAIClient(api.client(), KEY, default_model="m").generate_text("x")
    assert exc_info.value.code == "AI_REFUSED"


async def test_openai_empty_text() -> None:
    api = MockApi(openai_reply("", finish="length"))
    with pytest.raises(IntegrationInvalidResponseError, match="finish reason: length") as exc_info:
        await OpenAIClient(api.client(), KEY, default_model="m").generate_text("x")
    assert exc_info.value.code == "AI_EMPTY_RESPONSE"


async def test_openai_unexpected_shape() -> None:
    api = MockApi(httpx.Response(200, json={"model": "m", "choices": []}))
    with pytest.raises(IntegrationInvalidResponseError):
        await OpenAIClient(api.client(), KEY, default_model="m").generate_text("x")


async def test_ai_generation_is_retried_on_transient_failure() -> None:
    api = MockApi(httpx.Response(503), openai_reply("ok"))
    result = await OpenAIClient(api.client(), KEY, default_model="m").generate_text("x")
    assert result.text == "ok"
    assert len(api.requests) == 2


async def test_ai_timeout() -> None:
    api = MockApi(httpx.ReadTimeout("slow"))
    with pytest.raises(IntegrationTimeoutError):
        await OpenAIClient(api.client(), KEY, default_model="m").generate_text("x")


# --- Gemini ------------------------------------------------------------------------------


async def test_gemini_generate_text() -> None:
    api = MockApi(gemini_reply({"text": "thinking...", "thought": True}, {"text": "Hel"}, {"text": "lo"}))
    client = GeminiClient(api.client(), KEY, default_model="gemini-x")

    result = await client.generate_text(
        [
            ChatMessage(role="user", content="hi"),
            ChatMessage(role="assistant", content="yo"),
            ChatMessage(role="user", content="?"),
        ],
        system="Be nice",
        max_tokens=64,
    )

    assert result.text == "Hello"
    assert result.model == "gemini-test"
    assert result.usage is not None and result.usage.output_tokens == 2
    assert str(api.last.url) == "https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent"
    assert api.last.headers["x-goog-api-key"] == "test-key-123"
    assert "Authorization" not in api.last.headers
    body = api.body()
    assert [c["role"] for c in body["contents"]] == ["user", "model", "user"]
    assert body["systemInstruction"] == {"parts": [{"text": "Be nice"}]}
    assert body["generationConfig"] == {"maxOutputTokens": 64}


async def test_gemini_structured_output() -> None:
    api = MockApi(gemini_reply({"text": json.dumps(PERSON)}))
    person = await GeminiClient(api.client(), KEY, default_model="g").generate_structured("Ada?", Person)

    assert person.address.city == "London"
    config = api.body()["generationConfig"]
    assert isinstance(config, dict)
    assert config["responseMimeType"] == "application/json"
    assert config["responseJsonSchema"] == json_schema_for(Person)


async def test_gemini_blocked_prompt() -> None:
    api = MockApi(httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}}))
    with pytest.raises(IntegrationInvalidResponseError, match="SAFETY") as exc_info:
        await GeminiClient(api.client(), KEY, default_model="g").generate_text("x")
    assert exc_info.value.code == "AI_BLOCKED"


async def test_gemini_rejects_unsafe_model_names() -> None:
    api = MockApi()
    with pytest.raises(ValueError, match="invalid Gemini model name"):
        await GeminiClient(api.client(), KEY, default_model="g").generate_text("x", model="../../files")
    assert api.requests == []


# --- Anthropic ---------------------------------------------------------------------------


async def test_anthropic_generate_text() -> None:
    api = MockApi(anthropic_reply({"type": "text", "text": "Bonjour"}))
    client = AnthropicClient(api.client(), KEY, default_model="claude-x")

    result = await client.generate_text("Say hi in French", system="Be brief", max_tokens=20)

    assert result.text == "Bonjour"
    assert result.finish_reason == "end_turn"
    assert str(api.last.url) == "https://api.anthropic.com/v1/messages"
    assert api.last.headers["x-api-key"] == "test-key-123"
    assert api.last.headers["anthropic-version"] == "2023-06-01"
    assert api.body() == {
        "model": "claude-x",
        "max_tokens": 20,
        "messages": [{"role": "user", "content": "Say hi in French"}],
        "system": "Be brief",
    }


async def test_anthropic_structured_output_uses_forced_tool() -> None:
    api = MockApi(anthropic_reply({"type": "tool_use", "name": "structured_output", "input": PERSON}, stop="tool_use"))
    person = await AnthropicClient(api.client(), KEY, default_model="c").generate_structured("Ada?", Person)

    assert person.name == "Ada"
    body = api.body()
    assert body["tool_choice"] == {"type": "tool", "name": "structured_output"}
    assert body["tools"][0]["input_schema"] == json_schema_for(Person)


async def test_anthropic_structured_output_missing_tool_call() -> None:
    api = MockApi(anthropic_reply({"type": "text", "text": "Sure!"}))
    with pytest.raises(IntegrationInvalidResponseError) as exc_info:
        await AnthropicClient(api.client(), KEY, default_model="c").generate_structured("x", Person)
    assert exc_info.value.code == "AI_INVALID_STRUCTURED_OUTPUT"


# --- shared ------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("client_type", "env_var"),
    [
        (OpenAIClient, "OPENAI_API_KEY"),
        (GrokClient, "GROK_API_KEY"),
        (GeminiClient, "GEMINI_API_KEY"),
        (AnthropicClient, "ANTHROPIC_API_KEY"),
    ],
)
async def test_missing_api_key_is_a_clear_configuration_error(client_type: type[AIClient], env_var: str) -> None:
    api = MockApi()
    client = client_type(api.client(), None, default_model="m")
    with pytest.raises(IntegrationNotConfiguredError, match=env_var):
        await client.generate_text("hello")
    assert api.requests == []


async def test_empty_prompt_is_rejected_before_any_request() -> None:
    api = MockApi()
    with pytest.raises(ValueError, match="prompt must not be empty"):
        await OpenAIClient(api.client(), KEY, default_model="m").generate_text("   ")
    assert api.requests == []


def test_parse_structured_accepts_code_fenced_json() -> None:
    fenced = f"```json\n{json.dumps(PERSON)}\n```"
    assert parse_structured("test", fenced, Person).age == 36


def test_json_schema_for_inlines_nested_models() -> None:
    schema = json_schema_for(Person)
    assert "$defs" not in schema
    assert json.loads(json.dumps(schema))["properties"]["address"]["properties"]["city"] == {
        "title": "City",
        "type": "string",
    }
