## Context

Code review of 2026-10-24. Palanquée drafts are tied to a specific selection publication (`palanquee_drafts.selection_publication_id`, migration `20261002080000_palanquees.sql`).

## Problem

As soon as **one** selected diver withdraws, or the selection is republished (for example to add a replacement):

- `set_draft_palanquee` raises "La sélection a changé. Abandonnez le brouillon avant de le reprendre." (source ≠ latest publication);
- `publish_palanquees` refuses if any draft row is no longer in `current_selected_ids`;
- `src/features/palanquees/Palanquees.tsx` computes `staleDraft` and disables **every** select and the publish button.

The admin must discard the whole draft and redo all assignments (~20 divers). Last-minute withdrawals are the most common real situation, so the work is lost exactly when time is shortest.

## Proposed change

Rebase the draft instead of rejecting it. All of this must happen under the existing session row lock.

1. Add a new migration with an internal helper `rebase_palanquee_draft(p_session_id)` that:
   - deletes `palanquee_draft` rows whose member is not in `current_selected_ids(p_session_id)`;
   - sets `palanquee_drafts.selection_publication_id` to the latest selection publication.
2. Call it from `set_draft_palanquee` and `publish_palanquees` (after the lock and `ensure_palanquee_draft`), replacing the "La sélection a changé" rejections.
3. Return or expose what was pruned so the UI can tell the admin, for example "2 affectations retirées : X, Y se sont désistés". Options: a small `get_palanquee_draft_state` RPC, or a notice derived client-side by comparing before and after. Pick the simpler one.
4. UI: remove the `staleDraft` hard block. Show an informational message listing removed or newly confirmed divers ("à répartir").
5. Keep the guarantees from D025: published palanquées stay immutable, members never see drafts, and `get_palanquee_state.needs_review` behaviour for *published* groups is unchanged.
6. Update `docs/specs.md`/`docs/decisions.md` (D017/D025 neighbourhood) to describe the rebase rule.

## Acceptance criteria

- pgTAP: with a draft of N assignments, one selected member withdraws, and `set_draft_palanquee` on another member succeeds. The withdrawn member's row is gone and the other N−1 rows are kept.
- pgTAP: after a re-publication of the selection that adds a member, the draft keeps the existing assignments and the new member can be assigned. Publishing works.
- pgTAP: non-admins still cannot read drafts, and published snapshots are still immutable.
- Existing `supabase/tests/palanquees.test.sql` and `e2e/palanquees.spec.ts` updated (some assertions currently expect the rejection) and passing.

## Constraints

Follow `AGENTS.md`. New migration only, regenerate `database.types.ts`, and use the required PR format. Call out the behaviour change explicitly in the PR description, since it changes an existing rule.
