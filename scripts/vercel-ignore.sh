#!/usr/bin/env bash
# Vercel Ignored Build Step: exit 0 = skip build, exit 1 = build.
# Never skip on uncertainty.
set -euo pipefail

build() { echo "vercel-ignore: BUILD - $1"; exit 1; }
skip() { echo "vercel-ignore: SKIP - $1"; exit 0; }

# release-please pushes its release branch after every merge to develop; same code as develop.
case "${VERCEL_GIT_COMMIT_REF:-}" in
  release-please--*) skip "release-please branch ${VERCEL_GIT_COMMIT_REF}" ;;
esac

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  if [ -n "$base" ]; then
    git fetch --depth=50 origin >/dev/null 2>&1 || true
  fi
  if [ -z "$base" ] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
    base="HEAD^"
    if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
      git fetch --depth=50 origin >/dev/null 2>&1 || true
    fi
  fi
fi

git cat-file -e "${base}^{commit}" 2>/dev/null || build "base commit unavailable"

files="$(git diff --name-only --no-renames "$base" HEAD)" || build "git diff failed"
[ -n "$files" ] || build "no changed files detected"

while IFS= read -r f; do
  case "$f" in
    CHANGELOG.md | */CHANGELOG.md) build "$f is app-relevant" ;;
    supabase/* | .github/* | docs/* | *.md | scripts/backup-* | e2e/*) ;;
    *) build "$f is app-relevant" ;;
  esac
done <<< "$files"

skip "only database, CI, docs, backup or e2e files changed"
