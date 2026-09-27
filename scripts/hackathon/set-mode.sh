#!/usr/bin/env bash
# Set hackathon time band for the team/agents.
# Usage: ./scripts/hackathon/set-mode.sh <12+|6-12|2-6|<2>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BAND="${1:-}"
if [[ -z "$BAND" ]]; then
  echo "Usage: $0 <12+|6-12|2-6|<2>"
  exit 1
fi

case "$BAND" in
  '12+'|'6-12'|'2-6'|'<2') ;;
  *) echo "Invalid band: $BAND"; exit 1 ;;
esac

mkdir -p "$ROOT/.hackathon"
{
  echo "band=$BAND"
  echo "updated=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "priority=core-flow>reliability>ux>polish>testing>security>extras"
} > "$ROOT/.hackathon/mode.env"

cat > "$ROOT/.hackathon/CURRENT_MODE.md" << EOF
# Hackathon Mode: \`$BAND\`

Updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Priority
working core flow → reliability → UX → visual polish → testing → security → extras

## Band rules
EOF

case "$BAND" in
  '12+')
    cat >> "$ROOT/.hackathon/CURRENT_MODE.md" << 'EOF'
- Build properly
- Critical-path tests expected
- Avoid speculative rewrites
EOF
    ;;
  '6-12')
    cat >> "$ROOT/.hackathon/CURRENT_MODE.md" << 'EOF'
- MVP vertical slice only
- Defer polish and non-demo features
- Prefer stubs at non-demo edges
EOF
    ;;
  '2-6')
    cat >> "$ROOT/.hackathon/CURRENT_MODE.md" << 'EOF'
- Stabilize + polish demo path
- Freeze new architecture and new dependencies
- Bugfixes over features
EOF
    ;;
  '<2')
    cat >> "$ROOT/.hackathon/CURRENT_MODE.md" << 'EOF'
- Architecture freeze
- Blocker fixes only
- Protect the demo runbook
EOF
    ;;
esac

echo "Hackathon mode set to $BAND"
echo "Read: .hackathon/CURRENT_MODE.md"
echo "Agent prompt: prompts/hackathon/enter-mode.md"
