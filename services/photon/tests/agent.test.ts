import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createTextAgent, TRANSPORT_REPLY } from "../src/agent.ts";

type RequestBody = { contents: { role: string; parts: { text: string }[] }[]; generationConfig: { maxOutputTokens: number } };
const result = (text: string) => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }] });

function fixture(reply: () => Response = () => Response.json(result("A short answer."))) {
  const requests: { url: string; init: RequestInit; body: RequestBody }[] = [];
  const request: typeof fetch = async (url, init) => {
    assert.ok(init);
    requests.push({ url: String(url), init, body: JSON.parse(String(init.body)) as RequestBody });
    return reply();
  };
  return { requests, agent: createTextAgent({ apiKey: "test-only-key", fetch: request }) };
}

test("no key gives an explicit transport reply and performs no request", async () => {
  const agent = createTextAgent({ fetch: async () => { throw new Error("Must not fetch"); } });
  assert.equal(agent.mode, "transport");
  assert.equal(await agent.reply("chat", "hello"), TRANSPORT_REPLY);
});

test("generation uses the fixed HTTPS endpoint, header authentication, timeout and bounded output", async () => {
  const { agent, requests } = fixture();
  assert.equal(await agent.reply("chat", "hello"), "A short answer.");
  const request = requests[0]!;
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
  assert.equal(request.init.method, "POST");
  assert.equal(new Headers(request.init.headers).get("x-goog-api-key"), "test-only-key");
  assert.equal(request.init.redirect, "error");
  assert.ok(request.init.signal instanceof AbortSignal);
  assert.equal(request.body.generationConfig.maxOutputTokens, 1_024);
  assert.equal(request.body.contents[0]!.parts[0]!.text, "hello");
});

test("conversation history is scoped, retains only recent completed turns, and caps reply length", async () => {
  const { agent, requests } = fixture(() => Response.json(result("x".repeat(3_000))));
  for (let i = 0; i < 9; i++) assert.equal((await agent.reply("alice", `message-${i}`)).length, 2_000);
  assert.equal(requests[8]!.body.contents.length, 13);
  assert.equal(requests[8]!.body.contents[0]!.parts[0]!.text, "message-2");
  await agent.reply("bob", "hello");
  assert.equal(requests.at(-1)!.body.contents.length, 1);
});

test("old conversations are evicted when the total cap is reached", async () => {
  const { agent, requests } = fixture();
  for (let i = 0; i < 101; i++) await agent.reply(`chat-${i}`, "hello");
  await agent.reply("chat-0", "again");
  assert.equal(requests.at(-1)!.body.contents.length, 1);
});

test("conversation history expires after thirty idle minutes", async (t) => {
  let now = 1_000;
  t.mock.method(Date, "now", () => now);
  const { agent, requests } = fixture();
  await agent.reply("chat", "first");
  now += 30 * 60_000;
  await agent.reply("chat", "second");
  assert.equal(requests.at(-1)!.body.contents.length, 1);
});

test("oversize and empty input never reach Gemini", async () => {
  const { agent, requests } = fixture();
  assert.match(await agent.reply("chat", "x".repeat(4_001)), /4000 characters/);
  assert.equal(await agent.reply("chat", "  "), "Please send a text message.");
  assert.equal(requests.length, 0);
});

test("provider errors, timeout and invalid JSON return safe text without storing a failed turn", async () => {
  for (const failure of [
    () => new Response("test-only-key private-message", { status: 429 }),
    () => { throw new DOMException("test-only-key private-message", "TimeoutError"); },
    () => new Response("not json"),
  ]) {
    let fail = true;
    const { agent, requests } = fixture(() => fail ? failure() : Response.json(result("recovered")));
    const text = await agent.reply("chat", "private-message");
    assert.equal(text, "I couldn't get a Gemini response. Please try again shortly.");
    assert.doesNotMatch(text, /test-only-key|private-message/);
    fail = false;
    await agent.reply("chat", "retry");
    assert.equal(requests.at(-1)!.body.contents.length, 1);
  }
});

test("blocked, empty, malformed and oversized responses are not sent as generated answers", async () => {
  for (const value of [
    { promptFeedback: { blockReason: "SAFETY" } },
    { candidates: [{ finishReason: "SAFETY", content: { parts: [{ text: "blocked" }] } }] },
    result(" "),
    { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "hidden", thought: true }] } }] },
    result("x".repeat(256_001)),
    { candidates: "invalid" },
  ]) {
    const { agent } = fixture(() => Response.json(value));
    assert.equal(await agent.reply("chat", "hello"), "I couldn't get a Gemini response. Please try again shortly.");
  }
});

test("model overrides cannot redirect the key to another host or path", () => {
  for (const model of ["https://example.com/key", "gemini-3.8-flash/other", "gemini-3.8-flash?key=x"]) {
    assert.throws(() => createTextAgent({ apiKey: "test-only-key", model }), /model ID/);
  }
});

test("iMessage mode refuses missing Spectrum credentials before connecting", () => {
  const child = spawnSync(process.execPath, ["src/index.ts", "--imessage"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, SPECTRUM_PROJECT_ID: "", SPECTRUM_PROJECT_SECRET: "", GEMINI_API_KEY: "", GEMINI_MODEL: "gemini-3.8-flash" },
    encoding: "utf8",
    timeout: 10_000,
    windowsHide: true,
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /Cloud mode requires SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET/);
});
