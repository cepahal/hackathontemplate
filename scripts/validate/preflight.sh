#!/usr/bin/env bash
# Compatibility entry point; use npm run preflight on any supported platform.
set -euo pipefail
SCRIPT_DIR="${BASH_SOURCE[0]%/*}"
if [[ "$SCRIPT_DIR" == "${BASH_SOURCE[0]}" ]]; then SCRIPT_DIR=.; fi
ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
exec node "$ROOT/scripts/preflight.mjs"
