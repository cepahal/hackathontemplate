# Beginner 01 — Status & Diff

## Setup (mentor provides verbally or paste)
You return from coffee. The app won't start. An AI agent was left running.

You are given only:
```text
$ git status -sb
## feat/dashboard
 M backend/api/routes.py
 M backend/api/auth.py
 M frontend/src/pages/Dashboard.tsx
 M frontend/src/lib/api.ts
?? frontend/src/lib/apiClient.ts
?? backend/api/auth_v2.py
```

## Your job (reply in chat)
1. List FACTS only from this output.
2. What do you still NOT know?
3. What is the single next command you want, and why?
4. Do you restore anything yet? Why/why not?

## Mentor scoring
- Separates fact vs assumption
- Does not jump to `reset --hard`
- Asks for diff before destroy
