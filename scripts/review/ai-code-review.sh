#!/usr/bin/env bash
# AI code review helper — gathers diff context for an agent review.
# Usage:
#   ./scripts/review/ai-code-review.sh           # unstaged + staged vs HEAD
#   ./scripts/review/ai-code-review.sh origin/main  # since merge-base with main
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BASE_REF="${1:-HEAD}"
OUT_DIR="${ROOT}/.review"
mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="${OUT_DIR}/review-${STAMP}.md"

{
  echo "# AI Code Review Bundle"
  echo
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Base: \`${BASE_REF}\`"
  echo
  echo "## Instructions for the coding agent"
  echo
  echo "Use \`prompts/code-review/full-review.md\`."
  echo "Review dimensions: Correctness, Architecture, Security, Performance, Testing,"
  echo "API contracts, Database, Error handling, UX, Accessibility, Maintainability."
  echo
  echo "**Genuine findings only.** No generic best-practice noise."
  echo "Output P0/P1/P2 with paths. If clean: say No material findings + areas checked."
  echo
  echo "## Git status"
  echo
  echo '```'
  git status -sb || true
  echo '```'
  echo
  echo "## Diff stat"
  echo
  echo '```'
  if [[ "$BASE_REF" == "HEAD" ]]; then
    git diff --stat HEAD || true
    git diff --stat --cached || true
  else
    git diff --stat "$(git merge-base HEAD "$BASE_REF")"...HEAD || true
  fi
  echo '```'
  echo
  echo "## Diff"
  echo
  echo '```diff'
  if [[ "$BASE_REF" == "HEAD" ]]; then
    git diff HEAD || true
    git diff --cached || true
  else
    git diff "$(git merge-base HEAD "$BASE_REF")"...HEAD || true
  fi
  echo '```'
} > "$REPORT"

echo "Wrote $REPORT"
echo
echo "Next: open this file in your coding agent chat with prompts/code-review/full-review.md"
echo "Checklist: scripts/review/review-checklist.md"
