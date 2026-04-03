#!/bin/bash
# Dangerous commands check
DANGEROUS=("reset --hard" "clean -f" "push --force" "branch -D")

for cmd in "${DANGEROUS[@]}"; do
  if [[ "$@" == *"$cmd"* ]]; then
    echo "❌ Command blocked: $cmd"
    exit 1
  fi
done
exit 0
