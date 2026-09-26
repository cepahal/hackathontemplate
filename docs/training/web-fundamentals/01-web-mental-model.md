# 01 — Web Mental Model

## WHAT

A web app is a **conversation over HTTP** between a browser (or mobile client) and a server that may talk to a database or external APIs.

```text
Browser
  → HTTP request
    → Internet
      → Server (process listening on a port)
        → Application (your FastAPI/Next route code)
          → Database / external service
        ← Application builds a result
      ← HTTP response
  ← Browser updates UI (or errors)
```

## WHY

AI generates code in **layers**. Bugs live at **boundaries** between layers. If you don't have this map, you debug the wrong file.

## HOW (what happens at each stage)

| Stage | What actually happens |
|---|---|
| **Browser** | Runs HTML/CSS/JS. User clicks → JS may call `fetch`. Holds cookies, localStorage, React state |
| **HTTP request** | Bytes: method, path, query, headers, optional body. Not "a function call" — a message |
| **Internet** | DNS → TCP/TLS → packets. Timeouts and CORS happen *around* here (CORS enforced in browser) |
| **Server** | OS accepts socket; web server/ASGI hands request to your app |
| **Application** | Route match → auth → validate → business logic → call DB/API → shape response |
| **DB / external** | Separate systems with their own failures (constraints, 429s, latency) |
| **HTTP response** | Status + headers + body. Browser only sees this (plus timing) |
| **Browser again** | Parse JSON → setState → re-render — or show Network Error if response never readable |

## EXAMPLE

"Load dashboard":

1. React mounts → `useEffect` → `fetch('/api/activity', { credentials: 'include' })`
2. Request carries `Cookie: session=...`
3. FastAPI dependency reads session → loads user → queries `activity` where `user_id=?`
4. Returns `200` + JSON
5. React sets state → list renders

## FAILURE MODE

Any arrow can break while others succeed:

- UI shows logged-in (localStorage) but request has no cookie → **401**
- Server OK, DB empty → **200 []** → empty UI (not a "network bug")
- Server throws → **500**; browser only sees status unless you log server-side

## DEBUGGING

Ask: **What is the last hop that succeeded?**  
Network tab answers browser↔server. Logs answer server↔DB.

## AI-GENERATED CODE

When AI dumps a new `api.ts` + `router.py` + `models.py`, map each file to a hop before editing. If you can't, you don't understand the change yet.
