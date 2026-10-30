## Context

Code review of 2026-10-24. `import_season_calendar(jsonb)` (migration `20261003090000_rollout.sql`) and `scripts/import-calendar.mjs` with `data/calendar-2026-2027.json` only work for 2026–2027.

## Problem

The function hardcodes:

- the 11 allowed dates of 2026–2027;
- the key prefix `apsap-fosses-2026-2027/` (and the matching `CHECK` on `sessions.import_source_key`);
- the 1–11 array length;
- the advisory lock key `ifosse-calendar-2026-2027`.

Importing the 2027–2028 calendar next summer will need a new migration and code changes under time pressure.

## Proposed change

1. New migration: add `import_season_calendar_v2(p_season_start_year integer, p_sessions jsonb)` (service_role only, like v1). It should:
   - validate that every date falls in the season (Sept 1 to Aug 31) and that the year is in a sane range;
   - derive the key `apsap-fosses-<Y>-<Y+1>/<date>` and a per-season advisory lock;
   - keep the same idempotency semantics: an identical hash is a no-op, a changed hash raises, and an existing session at the same date/time raises;
   - bound the array length (for example 1–60).

   Relax the `import_source_key` CHECK to the generic pattern `^apsap-fosses-[0-9]{4}-[0-9]{4}/[0-9]{4}-[0-9]{2}-[0-9]{2}$`. Keep v1 for history, or drop it if nothing else uses it.
2. `scripts/import-calendar.mjs`: take `--season 2027` and the data file path. Keep "offline validation by default, explicit apply".
3. Update `docs/operator-guide.md` with the yearly procedure.

## Acceptance criteria

- pgTAP: import for 2027–2028 works; dates outside the season are rejected; re-running is idempotent; a changed source raises; non-service roles are denied.
- `scripts/import-calendar.test.mjs` covers the `--season` parsing and validation.
- Existing 2026–2027 imported rows still satisfy the new CHECK.
