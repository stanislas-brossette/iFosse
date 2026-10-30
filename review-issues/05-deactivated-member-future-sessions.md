## Context

Code review of 2026-10-24. `docs/member-management.md` documents that deactivating a member does **not** remove their selections or cars: "l'organisateur doit traiter séparément les changements opérationnels d'une séance future". This is a decision (D028), and this issue does **not** change it. It only makes the consequences visible.

## Problem

After deactivation, the member can still:

- hold a confirmed place in future published selections (counted in capacity);
- be a driver with passengers;
- appear in readiness as "prêt".

Nothing in the UI tells the president or organisers, so a place can stay blocked until someone notices.

## Proposed change

1. Add an RPC `get_member_future_commitments(p_member_id)`, admin-only. For sessions with `date >= today (Europe/Paris)` and status `open`, it returns `session_id`, date, title, `selected` (effective, via `current_selected_ids`), `is_driver` and `passenger_count`.
2. `Directory.tsx`: in the deactivation confirmation dialog, list these commitments ("Cette personne est confirmée pour la fosse du 4 novembre et conduit 2 passagers"). After deactivation, show the same list with links to each session's "Gestion" tab.
3. `get_admin_readiness`: expose a boolean `member_disabled`. In `PaymentSummary`/`Selection` management rows, show a chip "Accès désactivé".
4. No automatic withdrawal. Organisers still decide (respect D028).

## Acceptance criteria

- pgTAP: the RPC is admin-only and returns the correct selected/driver/passenger data. Past and closed sessions are excluded.
- UI tests: the dialog lists commitments, and the readiness chip appears for a disabled member.
- Docs: `member-management.md` mentions the new warning.
