# iFosse

iFosse is a small web application for organizing APSAP diving-pool ("fosse") sessions.

The project started as a replacement for the current Framadate + WhatsApp workflow used to coordinate registrations, participant selection, carpooling, payments and attendance.

## Current status

The repository contains the **V0 functional prototype** and a separate React + TypeScript production application under `src/`. The shared MVP is being implemented in the order listed in [the backlog](docs/mvp-backlog.md).

The V0 lives in:

`frontend/iFosse_V0.html`

The V0 is a standalone HTML application intended for functional validation only:

- no server;
- no real authentication;
- no shared database;
- demo users and demo data;
- local browser persistence only.

It remains the functional/UX reference while the real multi-user version is implemented.

The production direction is documented in:

- [MVP architecture](docs/architecture.md)
- [Production data model](docs/data-model.md)
- [MVP implementation backlog](docs/mvp-backlog.md)

## Main functional scope

The V0 covers:

- season calendar and session details;
- member responses: yes / maybe / no;
- registrations allowed beyond the session capacity;
- administrator selection of the final participants;
- draft selection followed by explicit publication;
- editable session capacity;
- carpool offers and passenger assignment;
- payment status: to pay / paid / free;
- actual attendance and season counters;
- simple palanquee grouping;
- member directory and profiles;
- basic exports and local backup.

See:

- [Functional specification](docs/specs.md)
- [Product decisions](docs/decisions.md)
- [Roadmap](docs/roadmap.md)
- [Original requirements](docs/cahier_des_charges.md)
- [V0 user guide](docs/iFosse_V0_guide.md)

## Run the V0

Download or clone the repository and open:

`frontend/iFosse_V0.html`

directly in a browser.

No installation is required.

## Run the shared application locally

Requirements: Node.js 22.12+ (22 LTS recommended), npm, and a running Docker engine accessible to your user. No hosted Supabase credentials are required for local development.

```sh
npm ci
npm run db:start
npm run db:reset
cp .env.example .env.local
```

Open local Supabase Studio at `http://127.0.0.1:54323` and copy the **publishable/anon** key into `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Never use a service-role/secret key. Then:

```sh
npm run dev
```

Open `http://localhost:5173`. The foundation shell can also run without `.env.local`; later authentication requires the completed configuration. Local email is captured at `http://127.0.0.1:54324`. Signup is disabled, and no real members or sessions are seeded. The database, Studio and mail ports bind to localhost through a dedicated Docker network.

Known-member provisioning, magic-link configuration, administrator rights and account recovery are documented in [authentication](docs/authentication.md). No invitations are sent by the import tool.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run db:test
npm run db:types -- --check
npm run db:restore-check
npx playwright install chromium
npm run test:e2e
```

Database migrations live in `supabase/migrations`. After changing them, reset the local database, run database tests and regenerate the committed types with `npm run db:types`. Reset deletes local development data. `npm run db:stop` stops the stack while preserving local volumes.

## Try the shared app with fictitious accounts

See [local acceptance instructions](docs/local-acceptance.md) for reproducible organizer/member setup, login through the captured email inbox and manual workflows. `npm run local:setup` explicitly restores the test member role; ordinary member imports intentionally preserve roles.

## Deployment environments

Netlify builds `dist/` using the unchanged build/test command in `netlify.toml`. Two separate sites share this repository:

| Netlify site | Primary (Netlify production) branch | iFosse environment | Supabase project |
| --- | --- | --- | --- |
| `ifosse-staging.netlify.app` | `staging` | `preview` | `ifosse-staging` |
| `ifosse.netlify.app` | `master` | `production` | `ifosse-production` |

**Netlify's `production` context means the site's primary deploy, not the application's environment.** The staging site's primary deploy must explicitly receive `VITE_APP_ENV=preview`. No `VITE_APP_ENV` value is hardcoded in TOML; set it alongside the other public variables in Netlify's environment settings, with **Builds** scope and explicit context values on each site.

Configure this exact public environment matrix. Public keys below mean the corresponding project's **publishable browser key**, supplied in Netlify; no privileged key belongs here.

| Variable | `ifosse-staging`: production + deploy-preview + branch-deploy | `ifosse`: production | `ifosse`: deploy-preview + branch-deploy |
| --- | --- | --- | --- |
| `VITE_APP_ENV` | `preview` | `production` | `preview` |
| `VITE_SUPABASE_PROJECT_ENV` | `preview` | `production` | `preview` |
| `VITE_SUPABASE_URL` | `https://btpojwwwsxrepsehmxbm.supabase.co` | `https://qjrpxuatsnvrqxhzklzq.supabase.co` | `https://btpojwwwsxrepsehmxbm.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | public publishable key of `ifosse-staging` | public publishable key of `ifosse-production` | public publishable key of `ifosse-staging` |
| `VITE_PREVIEW_SUPABASE_URL` | `https://btpojwwwsxrepsehmxbm.supabase.co` | `https://btpojwwwsxrepsehmxbm.supabase.co` | `https://btpojwwwsxrepsehmxbm.supabase.co` |
| `VITE_PRODUCTION_SUPABASE_URL` | `https://qjrpxuatsnvrqxhzklzq.supabase.co` | `https://qjrpxuatsnvrqxhzklzq.supabase.co` | `https://qjrpxuatsnvrqxhzklzq.supabase.co` |

If deploy previews or branch deploys are enabled on either site, explicitly supply their preview values before building them. Do not let non-primary deploys inherit production project's URL/key via shared/all-context defaults. Both sites pin both public project URLs to the same two distinct values; pinning a URL does not grant database access. Never configure service-role/secret keys or additional `VITE_*` variables in frontend builds. This PR's repository configuration does not update Netlify dashboard values automatically.

`src/lib/config.ts` continues to validate all six public variables at build and runtime. Hosted configurations require distinct HTTPS preview/production pins and the selected URL must match `VITE_APP_ENV`, even if an environment marker is mislabeled. `VITE_SUPABASE_PROJECT_ENV` must match the application environment; unexpected browser-prefixed variables and privileged key formats are rejected. No isolation checks are relaxed.

Local development remains `VITE_APP_ENV=local`, `VITE_SUPABASE_PROJECT_ENV=local`, the local API URL and local public key; hosted URL pins may remain unset locally. Preview/staging fixtures are synthetic; manually provisioned pilot accounts remain separate. Frontend builds do not apply migrations; apply reviewed migrations separately to the intended Supabase project. `.env.local`, local Netlify state, generated bundles and database runtime files are ignored by Git.

## Product principles

- Keep the workflow simple enough for a club of roughly 50 members.
- A session is the main entry point.
- A member's response and the administrator's final selection are separate concepts.
- Organizers remain in control of final selection.
- Avoid over-engineering the first production version.
- Preserve an upgrade path toward broader club-management features without putting them in the MVP.

## Development workflow

Use short-lived branches and pull requests for all meaningful changes.

Recommended flow:

1. Update the relevant product documentation when a rule changes.
2. Implement the change.
3. Add or update tests.
4. Open a PR describing both the functional and technical impact.
5. Merge after validation.

For coding-agent guidance, see [AGENTS.md](AGENTS.md).

The calendar groups sessions by September–August season. Administrators manage session details and responses; members can answer without a capacity cap. A missing/expired-on-session-day CACI asks for confirmation rather than blocking registration. Active pages refresh shared data every five seconds and when focused. PostgreSQL policies and RPCs enforce permissions independently of the interface.

Rollout procedures: [operator guide](docs/operator-guide.md), [tested recovery](docs/recovery.md), [privacy review](docs/privacy-review.md), and [real organizer pilot](docs/pilot-checklist.md). The real calendar import defaults to offline validation and never imports V0 demo registrations/history.

## Synthetic hosted staging data

The operator-only [staging seed workflow](docs/staging-seed.md) initializes 30 fictitious members and seven rich session scenarios on the pinned **ifosse-staging** project. After applying its reviewed migration to staging and configuring private operator environment variables:

```sh
npm run staging:seed
npm run staging:seed -- --apply
```

Default is a read-only target/ownership preflight and plan. Apply sends no emails, creates no passwords and preserves manually provisioned tester accounts. Reruns retain existing fixtures and tester edits without writes. Production is explicitly unsupported and positively rejected; there is no reset/delete mode. Privileged credentials belong only in the private operator environment, never frontend/Netlify configuration.

## Member management

Administration now uses one searchable directory. Admins maintain CACI; the President can add ordinary members (normal magic-link login), manage admin rights, and deactivate/reactivate access without deleting history. Operator bootstrap/recovery remains available. [Deployment and security guide](docs/member-management.md) documents the required staging Edge Function and Auth token hook; neither is installed by a Netlify frontend deploy. Hard deletion is intentionally excluded.
