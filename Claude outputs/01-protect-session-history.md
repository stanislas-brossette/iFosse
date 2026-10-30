## Context

Code review of 2026-10-24. `delete_session` (migration `20261002030000_sessions.sql`) only checks admin rights. It deletes any session, including one with a closed bilan, published selections, palanquées and attendance.

## Problem

- Deleting cascades to `session_participations`, `selection_publications`, `palanquee_publications`, `car_offers`, etc. The immutability guards allow this cascade because the parent session no longer exists.
- Members' season counts (`get_season_counts`) silently drop.
- `audit_events.session_id` is set to NULL (`on delete set null`). Only the payload keeps the id and date.
- This contradicts the V1 exit criterion "session history and attendance are durable" (`docs/roadmap.md`). `docs/decisions.md` excludes hard deletion of members but says nothing about sessions.
- The UI (`src/features/sessions/SessionEditor.tsx`, "Supprimer la séance") offers deletion for any session.

## Proposed change

1. Add a new migration that replaces `delete_session` and **refuses** deletion when **any** of these is true:
   - the session is `closed`;
   - a `selection_publications` row exists;
   - any `session_participations.attendance_status <> 'unknown'`.

   Use a clear French business message, for example "Cette séance a un historique (sélection publiée ou présences). Elle ne peut plus être supprimée."
2. Keep deletion available for sessions created by mistake (no publication, no attendance).
3. UI: map the new message in `src/lib/businessErrors.ts`. In `SessionEditor`, hide or disable "Supprimer la séance" when the session has a publication or is closed (the card summary already exposes `publication_version`), and explain why.
4. Optional, needs a product decision before implementing: add a "cancelled" state instead of deletion. **Do not implement without confirmation.** Mention it in the PR as a follow-up.
5. Record the rule as a new decision in `docs/decisions.md` and update `docs/specs.md`.

## Acceptance criteria

- pgTAP: deleting a closed session fails; deleting a session with a publication fails; deleting a session with recorded attendance fails; deleting a fresh session still works and is audited.
- E2E/unit: the delete button is not offered (or is disabled with an explanation) for a session with history.
- `npm run db:test`, `npm test`, `npm run db:types -- --check` and `npm run test:e2e` pass.

## Constraints

Follow `AGENTS.md`: decisions.md takes precedence, use a new migration (never edit applied ones), regenerate types, and write the PR description in the required format.
