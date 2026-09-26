# Hackathon Incident — AI refactored API — 12 endpoints failing


## Scene
AI renamed `/users/me` → `/v2/profile` and "updated clients" but mobile and one admin page still call old paths. Demo uses admin page.

## Your job
1. Boundary?
2. Fastest demo-safe fix: revert vs dual-route shim?
3. What git commands to isolate the AI commit?
