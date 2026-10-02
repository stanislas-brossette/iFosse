#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -gt 1 || (${1:-} != "" && ${1:-} != "--check") ]]; then
  echo "Usage: npm run db:types [-- --check]" >&2
  exit 2
fi

target="src/lib/database.types.ts"
generated="$(mktemp)"
trap 'rm -f "$generated"' EXIT

# npm scripts add the pinned, project-local Supabase binary to PATH. Generate
# into a temporary file so a failed command never truncates the committed file.
supabase gen types typescript --local --schema public |
  sed 's/[[:blank:]]*$//' > "$generated"

if [[ ${1:-} == "--check" ]]; then
  if ! diff -u "$target" "$generated"; then
    echo "Database types are stale. Reset the local database and run npm run db:types." >&2
    exit 1
  fi
else
  mkdir -p "$(dirname "$target")"
  cp "$generated" "$target"
fi
