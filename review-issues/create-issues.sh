#!/usr/bin/env bash
# Creates the 2026-10-24 code-review issues on GitHub.
# Usage (from anywhere, needs `gh auth login` done):  bash create-issues.sh
# Dry run:                                            DRY_RUN=1 bash create-issues.sh
set -euo pipefail
REPO="${REPO:-stanislas-brossette/iFosse}"
DIR="$(cd "$(dirname "$0")" && pwd)"

run() { if [ -n "${DRY_RUN:-}" ]; then echo "+ $*"; else "$@"; fi; }

# Labels (created or updated; --force makes this idempotent)
run gh label create "review-2026-10"   -R "$REPO" --color 5319e7 --description "From the 2026-10-24 code review" --force
run gh label create "priority:high"    -R "$REPO" --color b60205 --force
run gh label create "priority:medium"  -R "$REPO" --color d93f0b --force
run gh label create "priority:low"     -R "$REPO" --color fbca04 --force
run gh label create "needs-decision"   -R "$REPO" --color c5def5 --description "Product confirmation needed before merge" --force
run gh label create "bug"              -R "$REPO" --color d73a4a --force
run gh label create "enhancement"      -R "$REPO" --color a2eeef --force
run gh label create "security"         -R "$REPO" --color 000000 --force
run gh label create "performance"      -R "$REPO" --color 0e8a16 --force
run gh label create "refactor"         -R "$REPO" --color cfd3d7 --force

create() { # file, title, labels
  local file="$1" title="$2" labels="$3"
  # Skip if an open issue with the same title already exists (safe to re-run).
  if [ -z "${DRY_RUN:-}" ] && gh issue list -R "$REPO" --state open --search "\"$title\" in:title" --json title --jq '.[].title' | grep -Fxq "$title"; then
    echo "exists: $title"; return
  fi
  run gh issue create -R "$REPO" --title "$title" --body-file "$DIR/$file" --label "$labels"
}

create 01-protect-session-history.md              "Prevent deleting sessions that have history (closed / published / attendance)" "review-2026-10,priority:high,bug"
create 02-palanquee-draft-survives-withdrawals.md "Palanquée draft should survive withdrawals and selection re-publication"      "review-2026-10,priority:high,bug"
create 03-reduce-polling-load.md                  "Reduce polling load: pause hidden areas, single-session summary RPC"          "review-2026-10,priority:high,performance"
create 04-admin-own-caci-warning.md               "Warn admins about their own missing/expired CACI when answering Oui"          "review-2026-10,priority:medium,bug,needs-decision"
create 05-deactivated-member-future-sessions.md   "Show future commitments of deactivated members to organizers"                 "review-2026-10,priority:medium,enhancement"
create 06-generic-season-calendar-import.md       "Make the season calendar import work for any season"                          "review-2026-10,priority:medium,enhancement"
create 07-security-hardening.md                   "Security hardening: CSP, constant-time secret compare, single source for project pins" "review-2026-10,priority:medium,security"
create 08-small-frontend-fixes.md                 "Small frontend fixes (publish message, profile banner, notification errors, base64url)" "review-2026-10,priority:low,bug"
create 09-data-integrity-small-rules.md           "Purge old in-app notifications; block date change on closed sessions"         "review-2026-10,priority:low,enhancement,needs-decision"
create 10-maintainability-formatting-sql-helpers.md "Maintainability: formatter, component split, shared SQL helpers"             "review-2026-10,priority:low,refactor"
echo "Done."
