# Browser Debugging (Chrome DevTools)

Goal: decide the **failure boundary** from the browser in under 2 minutes.

## Panel cheat sheet

| Panel | Use for |
|---|---|
| **Console** | JS exceptions, failed assertions, your `console.log` evidence |
| **Network** | Status, timing, headers, payload, CORS, who called what |
| **Application** | Cookies, localStorage, sessionStorage, service workers |
| **Sources** | Breakpoints, pause on exceptions, step through |
| **Elements** | DOM/CSS; "is it rendered but invisible?" vs "not in DOM" |
| **Performance** | Long tasks, jank (rarely first tool in hackathon) |
| **React DevTools** | Props/state; which component has bad data |

## Network-first triage

1. Reproduce with Network open + **Preserve log**
2. Find the failing request (red / unexpected status)
3. Read: URL, method, status, request headers, request payload, response headers, response body
4. Classify:

| Status | Usually means | Next evidence |
|---|---|---|
| **404** | Wrong URL/route/deploy path | Compare client base URL vs server routes |
| **400** | Bad request shape | Request payload vs API schema |
| **401** | Not authenticated | Cookie/Authorization header present? expired? |
| **403** | Authenticated but forbidden | User id/role vs resource ownership |
| **409** | Conflict (duplicate, version) | Idempotency / unique constraints |
| **422** | Validation failed | Response body field errors |
| **429** | Rate limited | Retry-After; upstream quotas — don't "fix" with retries that worsen it |
| **500** | Server threw | Server logs/stack — browser only proves boundary |
| **502/503** | Gateway/upstream down | Deploy health, proxy, cold start |
| **CORS error** | Browser blocked read | Often looks like "network error"; check OPTIONS + `Access-Control-*` |
| **200 + empty UI** | Data/contract/render bug | Response body vs UI mapping |

## CORS vs offline vs wrong host

- **CORS:** request may appear, console shows CORS; response opaque to JS
- **Wrong host:** calls `localhost` from production site or vice versa
- **Mixed content:** HTTPS page calling HTTP API

## Cookies / storage

- Auth cookie: Secure, HttpOnly, SameSite, Domain, Path, expiration
- `localStorage` token: present? cleared on logout? sent in header?
- Split brain: frontend thinks logged in (storage) but API returns 401 (cookie missing)

## Realistic exercises (do these)

1. Force a 401: delete auth cookie → call dashboard API → note status + UI symptom  
2. Force CORS: point frontend to API without your origin allowlisted → describe console vs Network  
3. Force 422: submit empty required field → read response JSON  
4. 200 empty list: mock API `[]` → is empty state UI correct or does it spin forever?

## Drill question template

Always write:

```text
FACT: …
HYPOTHESIS: …
NEXT CHECK: …
```
