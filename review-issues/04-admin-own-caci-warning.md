## Context

Code review of 2026-10-24. **Needs product confirmation before merging**: check `docs/decisions.md` for any rule exempting admins.

## Problem

`set_session_rsvp` (latest version in migration `20261003190000_session_review.sql`) only raises `CACI_WARNING` when `not public.is_admin()`:

```sql
if p_rsvp='yes' and not public.is_admin() and (v_caci is null or v_caci<v_session.date) and not coalesce(p_confirm_caci_warning,false) then
```

The UI mirrors this in `src/features/sessions/Sessions.tsx` (`respond`: `target === member.id && !admin && ...`).

So an admin or president who answers **Oui for themselves** with a missing or expired CACI is never warned. Instructors are usually admins, and their CACI matters as much as anyone's. The exemption was probably meant only for an admin correcting **another** member's response.

## Proposed change

1. New migration: replace `set_session_rsvp` (same signature, same grants), changing the condition to warn when **the actor answers for themselves**: `v_target = v_actor` instead of `not public.is_admin()`. Admin corrections for others stay unwarned. Keep every other check identical.
2. UI: in `respond`, drop the `!admin` condition for the self case (`target === member.id`).
3. Update `docs/specs.md` (CACI warning paragraph) if it states the admin exemption.

## Acceptance criteria

- pgTAP: an admin with an expired CACI answering Oui for self → `CACI_WARNING`; with `p_confirm_caci_warning = true` → succeeds.
- pgTAP: an admin setting Oui for another member with an expired CACI → succeeds without confirmation (unchanged).
- Unit test for the SessionDetail warning dialog for an admin.
- `npm run db:test`, `npm test` and `npm run db:types -- --check` pass.
