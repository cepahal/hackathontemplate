import assert from "node:assert/strict";
import test from "node:test";
import { readEventStream } from "../src/lib/stream.ts";

function response(parts: Uint8Array[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
  );
}
const encode = (text: string) => new TextEncoder().encode(text);

test("split UTF8, CRLF and multiple events preserve content", async () => {
  const bytes = encode(
    'event: delta\r\ndata: {"text":"café"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n',
  );
  const events: [string, Record<string, unknown>][] = [];
  await readEventStream(
    response([...bytes].map((byte) => new Uint8Array([byte]))),
    (event, data) => events.push([event, data]),
  );
  assert.deepEqual(events, [
    ["delta", { text: "café" }],
    ["done", {}],
  ]);
});

test("multiline data and final unterminated event are consumed", async () => {
  const events: Record<string, unknown>[] = [];
  await readEventStream(
    response([encode('data: {\ndata: "text": "answer"\ndata: }')]),
    (_, data) => events.push(data),
  );
  assert.deepEqual(events, [{ text: "answer" }]);
});

test("malformed JSON fails instead of displaying a successful completion", async () => {
  await assert.rejects(
    readEventStream(response([encode("data: broken\n\n")]), () => {}),
    SyntaxError,
  );
});

test("consumer error cancels the reader", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encode("data: {}\n\n"));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readEventStream(new Response(stream), () => {
      throw new Error("Stop");
    }),
    /Stop/,
  );
  assert.equal(cancelled, true);
});
