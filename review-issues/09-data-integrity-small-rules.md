## Context

Code review of 2026-10-24. Two small database-side gaps. Item 2 needs a quick product confirmation.

## Items

### 1. `app_notifications` is never purged

`member_notifications` has a 90-day retention (in `claim_member_notifications`), but `app_notifications` (migration `20261018120000_in_app_notifications.sql`) grows forever.

- Add a retention rule, for example delete **read** notifications older than 180 days and any older than 365 days. Pick values and record them in `docs/in-app-notifications.md` and `docs/privacy-review.md`.
- Implement it as a `security definer` function `purge_app_notifications()` granted to `service_role`. Run it either from `pg_cron` if already used (see the member-notifications setup) or opportunistically inside `get_my_notifications` for the caller's own rows. Prefer the simplest option consistent with existing operations docs.

### 2. Moving a closed session changes season counts silently

`save_session` lets an admin change `date` on a **closed** session, even to another season. That shifts `get_season_counts` without any audit of the date change (the audit payload only records capacity).

- When `status = 'closed'`, refuse a date change with "Rouvrez le bilan avant de modifier la date." (other fields stay editable).
- Add `previous_date`/`date` to the `session_updated` audit payload when the date changes.
- UI: in `SessionEditor`, disable the date field for closed sessions, with a hint.

## Acceptance criteria

- pgTAP for both items: purge only removes eligible rows and is not callable by `authenticated`; a date change on a closed session fails; other edits still succeed; the audit payload contains the dates.
- Docs updated. Types regenerated if signatures change.
