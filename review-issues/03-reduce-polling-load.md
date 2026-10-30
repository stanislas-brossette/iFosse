## Context

Code review of 2026-10-24. Shared data is refreshed by `src/lib/useSharedRefresh.ts` (every 5 s while `document.visibilityState === 'visible'`, plus on focus).

## Problem

Much more is polled than what is on screen:

- `src/App.tsx` mounts Sessions, Profile and Directory together and only toggles the `hidden` attribute. `Directory` therefore keeps polling `members` every 5 s while an admin is on the sessions page.
- `Sessions` (calendar) keeps running its `load` (all sessions + `get_season_counts` + `get_session_card_summaries` per season) while a `SessionDetail` is open.
- `SessionDetail.load` calls `get_session_card_summaries` for the **whole season** just to read one session's row.
- `get_session_card_summaries` (migration `20261007010000`) calls `get_current_selection`, `get_session_transport` and `current_selected_ids` for every session.
- `AuthGate` also polls `members` every 5 s. `NotificationCenter` polls every 15 s.

An admin on the "Gestion" tab sends about 14 requests every 5 s. That is wasteful for phones (battery and data) and for the Supabase quota.

## Proposed change (phase 1, this issue)

1. Give `useSharedRefresh` an `active` flag (`useSharedRefresh(load, active = true)`). When it is false, there is no interval and no focus refresh. When it becomes true, refresh immediately.
2. `App.tsx`: pass `active` down so hidden areas don't poll (or don't mount Directory when hidden, if that doesn't break unsaved-change guards; check `useUnsavedChanges`).
3. `Sessions`: don't poll the calendar while a session detail or the editor is open. Refresh once when returning to the list.
4. Add an RPC `get_session_card_summary(p_session_id)` that returns the same row shape as `get_session_card_summaries` for one session (same permission checks). Use it in `SessionDetail`.
5. Keep the existing safety behaviour: sequence guards, "les dernières données reçues sont conservées" messages, and the stale-projection detection.

## Out of scope / follow-up

Phase 2 (separate issue, needs a decision): replace polling with a Supabase Realtime **broadcast**. An `after insert` trigger on `audit_events` sends "session <id> changed", and clients refetch only on that signal. This must not expose private columns, which is why polling was chosen originally (see the comment in `useSharedRefresh.ts`).

## Acceptance criteria

- Unit test for `useSharedRefresh`: no calls while inactive, and an immediate call on activation.
- Unit/E2E: with an admin on a session detail, Directory and calendar loads do not fire (spy on the client).
- pgTAP for `get_session_card_summary`: same values as the season version for that session, and the same permission failures for unauthenticated or disabled users.
- All existing tests pass. No visible behaviour change other than fewer requests.
