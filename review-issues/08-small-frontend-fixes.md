## Context

Code review of 2026-10-24. These are small, independent frontend bugs. One PR is fine; add a regression test for each.

## Items

1. **Stuck "Publication en cours…"**: `src/features/selection/Selection.tsx`, `publish()`. The message is set before the `if (!preview)` early return, so it stays on screen. Check `preview` first, or clear the message on that path.

2. **Flashing "Profil indisponible" banner**: `src/features/auth/AuthGate.tsx`, `refresh()`. The 5 s profile poll sets the error on a single transient network failure. Only show the error after 2 consecutive failures (or when there is no member loaded yet). Keep the immediate `setMember(null)` for 401/403/PGRST301/PGRST302.

3. **Invisible notification errors**: `src/features/notifications/NotificationCenter.tsx`. If the first `get_my_notifications` call fails, `inbox` stays null, the component returns null and the user never sees the bell or the error. Keep it hidden only for the "feature unavailable" codes (`PGRST202`, `42883`) and when `enabled === false`. For other failures, render the bell with an error state after a retry.

4. **Anon JWT check uses `atob` on base64url**: `src/lib/config.ts`. `atob(key.split('.')[1])` throws on `-`/`_`, so a valid legacy anon JWT can be rejected. Convert from base64url (`replace(/-/g,'+').replace(/_/g,'/')` plus padding) before `atob`. Add cases to `config.test.ts`.

## Acceptance criteria

- One regression test per item (Vitest + Testing Library).
- `npm run typecheck && npm run lint && npm test` pass.
