#!/usr/bin/env bash
# Preflight validation for the app in finalfrontentbackend/ — best-effort.
# Exits non-zero if obvious blockers are found. Never prints env values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/finalfrontentbackend"
FRONTEND="$APP/frontendFINAL"
BACKEND="$APP/backendFINAL"

FAIL=0
warn() { echo "WARN: $*"; }
fail() { echo "FAIL: $*"; FAIL=1; }
ok() { echo "OK:   $*"; }

echo "== Preflight =="

if [[ ! -f "$ROOT/AGENTS.md" ]]; then fail "AGENTS.md missing"; else ok "AGENTS.md present"; fi

if [[ -f "$FRONTEND/package.json" ]]; then
  ok "Found frontendFINAL"
  if command -v npm >/dev/null 2>&1; then ok "npm available"; else fail "npm missing"; fi
  if [[ -d "$FRONTEND/node_modules" ]]; then
    ok "frontend node_modules present"
    if (cd "$FRONTEND" && npm run -s lint >/dev/null 2>&1); then ok "frontend lint"; else warn "frontend lint failed"; fi
    if (cd "$FRONTEND" && npm run -s typecheck >/dev/null 2>&1); then ok "frontend typecheck"; else warn "frontend typecheck failed"; fi
  else
    warn "frontend node_modules missing — run: cd finalfrontentbackend/frontendFINAL && npm install"
  fi
  if [[ -f "$FRONTEND/.env.local" ]]; then ok "frontendFINAL/.env.local present (values not printed)"; else warn "frontendFINAL/.env.local missing — copy from .env.example"; fi
else
  fail "finalfrontentbackend/frontendFINAL not found"
fi

if [[ -f "$BACKEND/requirements.txt" ]]; then
  ok "Found backendFINAL"
  if command -v python3 >/dev/null 2>&1; then ok "python3 available"; else fail "python3 missing"; fi
  if [[ -x "$BACKEND/.venv/bin/python" ]]; then ok "backend .venv present"; else warn "backend .venv missing — see finalfrontentbackend/docs/SETUP.md"; fi
  if [[ -f "$BACKEND/.env" ]]; then ok "backendFINAL/.env present (values not printed)"; else warn "backendFINAL/.env missing — copy from .env.example"; fi
else
  fail "finalfrontentbackend/backendFINAL not found"
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "== Preflight FAILED =="
  exit 1
fi
echo "== Preflight passed (with possible warnings) =="
