#!/usr/bin/env bash
# One-off: staging's data into production (.github/workflows/copy-staging-to-production.yml).
# Reads the two staging dumps in <dir> (data.sql: public and auth in one snapshot; migrations.sql;
# both `supabase db dump --data-only --use-copy`), refuses anything unexpected, prints the row
# counts per table and writes <dir>/expected.sql: BEGIN plus two temp tables (the expected counts,
# staging's migration versions) that checks-and-wipe.sql and verify.sql check production against
# inside the same transaction.
# Usage: scripts/copy-staging-to-production/prepare.sh <dir>
set -euo pipefail

dir=${1:?usage: prepare.sh <dir>}
for f in data migrations; do
  test -s "$dir/$f.sql" || { echo "::error::$dir/$f.sql is missing or empty"; exit 1; }
done

# Rows per COPY block: in COPY text format a row is one line (newlines inside values are escaped as
# \n) and a block ends with a line that is exactly "\.". pg_dump writes a block for every table it
# dumps, empty ones too.
count_rows() {
  awk '
    /^COPY "[^"]+"\."[^"]+" .* FROM stdin;$/ {
      split($2, p, "\""); schema = p[2]; table = p[4]; n = 0; inblock = 1; next
    }
    inblock && $0 == "\\." { printf "%s\t%s\t%d\n", schema, table, n; inblock = 0; next }
    inblock { n++ }
    END { if (inblock) { print "unterminated COPY block for " schema "." table > "/dev/stderr"; exit 1 } }
  ' "$1"
}

counts=$(count_rows "$dir/data.sql")

fail=0
# The dump must hold only public and auth tables.
if awk -F'\t' '$1 != "public" && $1 != "auth" { found = 1 } END { exit !found }' <<<"$counts"; then
  echo "::error::A dump holds a table outside public and auth."; fail=1
fi
# Push devices stay behind: they belong to staging's address and VAPID keys.
if awk -F'\t' '$1 == "public" && $2 == "push_subscriptions" { found = 1 } END { exit !found }' <<<"$counts"; then
  echo "::error::public.push_subscriptions is in the dump; it must be excluded."; fail=1
fi
# Logins: only the accounts and their sign-in methods. Any other auth table with rows (MFA, SSO,
# OAuth apps, ...) is something this copy wasn't built for: stop instead of dropping it silently.
unexpected=$(awk -F'\t' '$1 == "auth" && $3 > 0 && $2 != "users" && $2 != "identities" { print $1 "." $2 " (" $3 " rows)" }' <<<"$counts")
if [ -n "$unexpected" ]; then
  echo "::error::Staging has rows in auth tables this copy doesn't handle: $(echo "$unexpected" | paste -sd, -)"; fail=1
fi
for t in public.profiles public.habits public.check_ins auth.users auth.identities; do
  n=$(awk -F'\t' -v t="$t" '$1 "." $2 == t { print $3 }' <<<"$counts")
  if [ -z "$n" ] || [ "$n" -eq 0 ]; then
    echo "::error::$t is missing or empty in the staging dump."; fail=1
  fi
done

# Staging's applied migrations: the first column of supabase_migrations.schema_migrations.
versions=$(awk '
  /^COPY "supabase_migrations"\."schema_migrations" / { inblock = 1; next }
  inblock && $0 == "\\." { inblock = 0; next }
  inblock { split($0, f, "\t"); print f[1] }
' "$dir/migrations.sql")
if ! grep -qE '^[0-9]{14}$' <<<"$versions" || grep -vqE '^[0-9]{14}$' <<<"$versions"; then
  echo "::error::Could not read staging's migration versions from the dump."; fail=1
fi
[ "$fail" -eq 0 ] || exit 1

echo "Staging rows to copy (push_subscriptions and sessions are left out on purpose):"
awk -F'\t' '$1 == "public" || $3 > 0 { printf "  %-40s %8d\n", $1 "." $2, $3 }' <<<"$counts"
echo "Staging migrations: $(wc -l <<<"$versions" | tr -d ' ') (latest $(tail -1 <<<"$versions"))"

{
  echo "begin;"
  echo "create temp table copy_expected (schema_name text not null, table_name text not null, n bigint not null, primary key (schema_name, table_name)) on commit drop;"
  echo "copy pg_temp.copy_expected from stdin;"
  printf '%s\n' "$counts"
  echo '\.'
  echo "create temp table copy_staging_migrations (version text primary key) on commit drop;"
  echo "copy pg_temp.copy_staging_migrations from stdin;"
  printf '%s\n' "$versions"
  echo '\.'
} >"$dir/expected.sql"
