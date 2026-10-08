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
if [ -n "$base" ]; then
  # The last deployed commit of this branch; Vercel's clone is shallow, so it may need fetching.
  if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
    git fetch --depth=50 origin >/dev/null 2>&1 || true
  fi
  git cat-file -e "${base}^{commit}" 2>/dev/null || build "previous commit ${base} unavailable"
else
  # Nothing deployed on this branch yet (a new branch): compare with where it left develop, not
  # with HEAD^ (an app commit followed by a docs-only one must still build).
  if ! git rev-parse -q --verify "origin/develop^{commit}" >/dev/null; then
    git fetch --depth=50 origin "+refs/heads/develop:refs/remotes/origin/develop" >/dev/null 2>&1 || true
  fi
  base="$(git merge-base HEAD origin/develop 2>/dev/null)" || build "no merge base with origin/develop"
fi

files="$(git diff --name-only --no-renames "$base" HEAD)" || build "git diff failed"
[ -n "$files" ] || build "no changed files detected"

while IFS= read -r f; do
  case "$f" in
    CHANGELOG.md | */CHANGELOG.md) build "$f is app-relevant" ;;
    supabase/functions/_shared/*) build "$f is shared with the app" ;;
    docs/privacy-policy.md) build "$f is the /privacy page" ;;
    docs/install/*) build "$f is a picture on the /install page" ;;
    supabase/* | .github/* | docs/* | *.md | scripts/backup-* | e2e/*) ;;
    *) build "$f is app-relevant" ;;
  esac
done <<< "$files"

skip "only database, CI, docs, backup or e2e files changed"
