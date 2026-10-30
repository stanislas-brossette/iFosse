## Context

Code review of 2026-10-24. This is maintainability work with no behaviour change. Do it **after** the functional issues, to avoid merge conflicts, and split it into several small PRs.

## Problem

- Very dense code: many lines are 300–600 characters (for example `src/features/selection/Selection.tsx`, `src/features/sessions/Sessions.tsx`, `src/features/carpooling/Carpooling.tsx`, and most SQL migrations written as one-liners). Reviews and diffs are hard to read.
- Repeated SQL fragments:
  - "latest selection publication id" (`select id from public.selection_publications where session_id=… order by version desc limit 1`) appears ~15 times;
  - the "effective selection state" CASE is duplicated in `get_current_selection` and `notify_app_audit` (the comment there admits it).
- `src/features/payments/Payments.tsx` has no unit test.

## Proposed change (separate PRs)

1. **Formatting (TS):** add Prettier (or `oxfmt` if preferred, to match oxlint) with a check in CI (`npm run format:check`) and Netlify's build command. Apply it in one mechanical commit. Don't reformat existing migrations: they are applied history.
2. **Component split:** extract subcomponents and hooks from `Selection.tsx` (published summary, participants list, management list, publish preview), `Sessions.tsx` (calendar grid, session card, response corrections) and `Carpooling.tsx` (own car, booked trip, car list). No behaviour change, and existing tests must pass unchanged.
3. **SQL helpers (new migration):** add `latest_selection_publication(p_session_id) returns uuid` and `effective_selection_state(...)` (stable, security definer, `search_path=''`, no grants to clients). Re-create the functions that duplicate the logic so they use the helpers. pgTAP tests must pass unchanged. Write new migrations in a readable multi-line style from now on, and add a short SQL style note to `AGENTS.md`.
4. **Tests:** add `Payments.test.tsx` covering the readiness score, draft vs published basis and the payment change error path.

## Acceptance criteria

- CI is green, with no snapshot or behaviour changes in E2E.
- Each PR stays focused and reviewable (per `AGENTS.md`).
