#!/bin/bash
# Runs the full regression suite (every test_*.js in this folder) against the project one level up.
# Portable: resolves paths relative to this script's own location, so it works from any clone path.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/.."
TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_FILES=""
for f in "$DIR"/test_*.js; do
  out=$(node "$f" 2>&1)
  p=$(echo "$out" | grep -oE '[0-9]+ passed' | tail -1 | grep -oE '^[0-9]+')
  fcount=$(echo "$out" | grep -oE '[0-9]+ failed' | tail -1 | grep -oE '^[0-9]+')
  if [ -z "$p" ]; then p=0; fi
  if [ -z "$fcount" ]; then fcount=0; fi
  TOTAL_PASS=$((TOTAL_PASS + p))
  TOTAL_FAIL=$((TOTAL_FAIL + fcount))
  if [ "$fcount" != "0" ]; then
    FAILED_FILES="$FAILED_FILES\n=== $f ===\n$out"
  fi
  echo "$(basename "$f"): $p passed, $fcount failed"
done
echo ""
echo "TOTAL: $TOTAL_PASS passed, $TOTAL_FAIL failed"
if [ -n "$FAILED_FILES" ]; then
  echo -e "$FAILED_FILES"
fi
