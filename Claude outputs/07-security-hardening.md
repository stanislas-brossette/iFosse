## Context

Code review of 2026-10-24. The database and auth model is solid. These are small, defence-in-depth hardening items.

## Items

### a) Content-Security-Policy and Permissions-Policy (`netlify.toml`)

Only `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` are set. Add:

- `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self'` (check whether inline styles are used; add `'unsafe-inline'` for styles only if strictly needed); `img-src 'self' data:`; `connect-src 'self'` plus the two pinned Supabase origins (`https://btpojwwwsxrepsehmxbm.supabase.co`, `https://qjrpxuatsnvrqxhzklzq.supabase.co`, and their `wss://` equivalents if Realtime is used later); `manifest-src 'self'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
- Verify locally with `npm run build && npx vite preview` and the PWA E2E (`e2e/pwa.spec.ts`). Make sure no CSP violations appear in the console during the E2E suite. Consider adding a Playwright assertion that fails on CSP console errors.

### b) Constant-time secret comparison (`supabase/functions/member-notifications/handler.mjs`)

`request.headers.get('Authorization') !== \`Bearer ${config.secret}\`` is a plain string comparison. Replace it with a constant-time compare: hash both values with SHA-256 via `crypto.subtle`, then compare the byte arrays in a loop without early exit. Add a test in `handler.test.mjs`.

### c) Single source of truth for pinned project refs

The two Supabase project refs are duplicated in:

- the SQL `CHECK`s and `configure_member_notifications` (migrations `20261008150000`, `20261018210000`);
- `supabase/functions/member-notifications/handler.mjs` (`pins`);
- `src/features/auth/redirect.ts` (site hostnames);
- the README and the CSP from (a).

Keep the pins (they are a deliberate safety net), but add a consistency test (for example a Vitest test reading the migration and handler sources) that fails if they diverge. Alternatively, export them from one shared module used by scripts, functions and tests.

## Acceptance criteria

- Headers are present on the Netlify deploy preview, and the app, login and PWA install work with no CSP errors.
- The handler test covers wrong-length and wrong-value secrets.
- The consistency test is in CI (`npm test`).
