# Hackathon Incident — Auth died 3 hours before demo


## Scene
Google login redirected back but dashboard immediately logs out.
Worked at lunch. AI "cleaned up cookies" mid-afternoon.

Partial log:
```text
INFO callback ok user=ada@ex.com
INFO set cookie session=... Secure=True
WARN /api/me 401
```

Local HTTP; production HTTPS.

## Incomplete on purpose
You don't have Application panel yet.

## Your job
1. List FACTS
2. Demand one piece of missing evidence
3. Rank hypotheses (include SameSite/Secure/HTTP)
4. Propose recovery if AI commit is the culprit
