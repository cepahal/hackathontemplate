# 04 — JavaScript Async Model

## WHAT
JS on the main thread is single-threaded. Async I/O uses the **event loop**: start operation, continue, resume when result is ready.

## WHY
Network/DB are slow. Blocking the UI thread freezes the page. `async/await` is syntax over Promises.

## HOW
```text
call stack → runs sync code
Web APIs / Node → timers, fetch
task queues → microtasks (Promises) then macrotasks (setTimeout)
event loop → pushes callbacks when stack empty
```

| Tool | Role |
|---|---|
| callback | old style continuation |
| Promise | thenable future value |
| async/await | sync-looking Promise code |
| try/catch | catches **rejected** awaited Promises |
| Promise.all | fail-fast parallel |
| Promise.race | first settled wins (timeouts) |
| concurrency | overlapping async waits |
| parallelism | true multi-core (workers) — different |

```js
async function load() {
  try {
    const r = await fetch("/api/me");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    // network fail OR throw above
  }
}
```

Timeout pattern:
```js
await Promise.race([
  fetch(url),
  new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
]);
```

## EXAMPLE
Three independent GETs: `await Promise.all([a,b,c])` — faster than sequential awaits.

## FAILURE MODE
- Floating promise: `fetch()` without await/catch → silent failure
- `Promise.all` one failure rejects all
- Race: slow response overwrites newer UI state
- try/catch around `fetch` without checking `r.ok` — 500 doesn't throw!

## DEBUGGING
Log order with labels; check Network timing; for races, ignore stale responses (abort controller / request id).

## AI-GENERATED CODE
Red flags: await in loop for independent calls; no `r.ok` check; empty catch; setState after unmount without guard.
