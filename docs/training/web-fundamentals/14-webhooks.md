# 14 — Webhooks

## WHAT
Provider **POSTs events** to your URL when something happens (payment succeeded, GitHub push).

```text
event → webhook HTTP POST → verify signature → handler → DB → 2xx response
```

## WHY
You don't poll. But providers **retry**; duplicates are normal.

## HOW
- **Signature:** HMAC of body with shared secret — reject if invalid  
- **Retries:** return 5xx → they retry; return 2xx quickly  
- **Idempotency:** store `event_id` UNIQUE; ignore duplicates  
- **Failure:** queue heavy work; ack early if needed

## EXAMPLE
Stripe `checkout.session.completed` → verify → mark order paid **once**.

## FAILURE MODE
No signature check → forged events. No idempotency → double-fulfill. Slow handler → timeouts → retry storms.

## DEBUGGING
Log event id + verification result; replay fixtures; check provider dashboard delivery attempts.

## AI-GENERATED CODE
Reject webhook routes without signature verification in production paths.
