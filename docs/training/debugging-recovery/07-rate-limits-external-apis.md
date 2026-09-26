# Rate Limits & External APIs

Change code last. Diagnose the upstream first.

## Recognition table

| Signal | Meaning | First move |
|---|---|---|
| **429** | Rate / quota | Read body + `Retry-After`; check provider dashboard |
| Timeout / connect error | Network, cold start, deadlock | Latency logs; increase timeout only after finding slowness |
| 401/403 from upstream | Bad/missing API key or scopes | Env key + provider logs |
| 400 from upstream | Your payload invalid | Diff against API docs/version |
| 404 upstream | Wrong resource/version base URL | Base path `/v1` vs `/v2` |
| 5xx upstream | Their outage | Status page; backoff; demo fallback |

## Before editing your app

1. Capture: URL, status, response body, request id, timestamp  
2. Reproduce with curl using same key (carefully)  
3. Check quota/billing/rate dashboards  
4. Confirm you're on the right API version  
5. Only then adjust client retries/backoff/caching

## Demo survival

- Cache successful responses for the demo path  
- Soft-fail UI with a clear message  
- Avoid retry storms that guarantee more 429s  

## AI rule

If AI says "add exponential backoff" without confirming 429/timeout evidence — demand Network/log proof first.
