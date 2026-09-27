#!/usr/bin/env bash
# Preflight validation — best-effort, stack-agnostic.
# Exits non-zero if obvious blockers are found.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FAIL=0
warn() { echo "WARN: $*"; }
fail() { echo "FAIL: $*"; FAIL=1; }
ok() { echo "OK:   $*"; }

echo "== Preflight =="

if [[ -f package.json ]]; then
  ok "Found package.json"
  if [[ -d node_modules ]]; then ok "node_modules present"; else warn "node_modules missing — run install"; fi
  if command -v npm >/dev/null 2>&1; then
    if npm run -s lint >/dev/null 2>&1; then ok "npm lint"; else warn "npm lint not configured or failed"; fi
    if npm run -s typecheck >/dev/null 2>&1; then ok "npm typecheck"; else warn "npm typecheck not configured or failed"; fi
  fi
fi

if [[ -f pyproject.toml || -f requirements.txt ]]; then
  ok "Found Python project markers"
  if command -v python3 >/dev/null 2>&1; then ok "python3 available"; else fail "python3 missing"; fi
fi

if [[ -f .env.example ]]; then
  ok "Found .env.example"
  if [[ -f .env ]]; then ok ".env present (values not printed)"; else warn ".env missing — copy from .env.example"; fi
else
  warn "No .env.example yet — add one before deploy"
fi

if [[ ! -f AGENTS.md ]]; then fail "AGENTS.md missing"; else ok "AGENTS.md present"; fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "== Preflight FAILED =="
  exit 1
fi
echo "== Preflight passed (with possible warnings) =="
