#!/usr/bin/env bash
# Runs a command up to 3 times, 10 s apart; fails only after the last try. For calls to Supabase's
# management API in the staging deploy, which sometimes fail once for no reason of ours (e.g.
# "Unauthorized" from its permission service, 2026-10-05).
# Usage: scripts/retry.sh <command> [args...]
set -uo pipefail
if (($# == 0)); then
  echo "Usage: scripts/retry.sh <command> [args...]" >&2
  exit 2
fi
tries=3
for ((i = 1; i <= tries; i++)); do
  "$@" && exit 0
  status=$?
  if ((i < tries)); then
    echo "::warning::Try $i of $tries failed (exit $status): $1. Retrying in 10 s." >&2
    sleep 10
  fi
done
echo "::error::Failed after $tries tries: $1" >&2
exit "$status"
