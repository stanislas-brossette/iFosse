# Shared-app visual acceptance

The React application adapts the V0 visual reference: ink `#183642`, teal `#087f82`, muted `#5d7380`, soft white cards and a pale background. The source prototype remains unchanged. No V0 JavaScript, persona switching, localStorage data architecture or demo badges are used. Lightweight React primitives supply the brand/icons, page headings, date tiles and keyboard-operable tabs; no UI framework or remote fonts were added.

Desktop uses a fixed left sidebar, user identity/role top bar, readable content width and multi-column session/car/group cards. Phones use bottom navigation, safe-area padding, one-column cards and scrollable tabs. Visible controls retain 44px targets; checkbox labels retain a 44px target. Focus outlines and textual state labels remain visible. Section changes return to the top without unmounting unsaved forms. Informational, primary, secondary and destructive actions have distinct treatments.

Gestion keeps published and draft counts distinct, groups selection rows by state and supports name search. Sticky publication actions stay reachable when scanning a long roster. Whole-club response corrections and president role management expand on demand. Session access details collapse outside Ma participation; their content remains available. These are presentation changes; publication, permissions, medical advisory and capacity rules are unchanged.

## Reproduce safe visual review

Run browser tests against a fresh local database as described in the README. `e2e/visual-acceptance.spec.ts` provisions and removes **50 synthetic profiles**, four sessions, **20 published confirmations**, 35 Yes/Maybe responses, three cars/nine passengers and four palanquées. Its private working selection deliberately differs from publication. It checks member/admin/president UI, role grant/revocation, name search, all session tabs, no horizontal overflow, minimum control height and keyboard tab focus. No real club data is used.

Desktop viewport: **1440 × 900**. Phone viewport: **390 × 844**.

Screenshots are written to ignored `test-results/visual-acceptance/`; CI saves only those PNGs as `safe-local-acceptance-screenshots` for seven days. Authentication traces/videos/storage exports are disabled. Screenshot capture happens with an empty URL fragment, after login; all displayed identities are synthetic. Individual screenshots are inspected visually in addition to the executable layout checks.

Required views:

- `desktop-member-sessions.png`
- `desktop-admin-gestion.png` (rows), `desktop-admin-gestion-overview.png`, `desktop-admin-gestion-full.png`
- `phone-member-sessions.png`
- `phone-session-detail.png`
- `phone-admin-gestion.png` (rows), `phone-admin-gestion-overview.png`, `phone-admin-gestion-full.png`
- `phone-member-profile.png`, `phone-admin-profile.png`, `desktop-admin-directory.png`, `phone-admin-directory.png`

Additional views cover login, president roles, participants, carpooling, palanquées and bilan. Final reviewed copies are retained locally in ignored `.private/visual-review-2026-10-04/` so later test runs do not erase the delivered artifacts. Screenshots and local CI do not replace hosted Auth/SMTP/Netlify validation or physical organizer acceptance.
