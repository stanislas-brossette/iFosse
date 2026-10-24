@AGENTS.md

## Working on review issues
- One GitHub issue = one branch (`fix/<n>-short-name`) = one PR. Read it with `gh issue view <n>`.
- Read docs/decisions.md and docs/specs.md before changing a rule. Issues labelled needs-decision: stop and ask.
- DB changes: new migration only (never edit applied ones), then `npm run db:reset && npm run db:test && npm run db:types`.
- Before the PR: typecheck, lint, test, build, db:test, `db:types -- --check`, and test:e2e if the UI changed.
- Never run staging:*, anything with --apply, deployments or email sending. Never read .private/ or .env*.
