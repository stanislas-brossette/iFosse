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

## Deployment environments

Netlify builds `dist/` using `netlify.toml`; pull requests use the deploy-preview context. Linking the GitHub repository to an existing Netlify site is an external setup step, tracked in [execution status](docs/execution-status.md).

Set public frontend variables separately for each Netlify build context:

| Variable | Local | Deploy preview / branch | Production |
| --- | --- | --- | --- |
| `VITE_APP_ENV` | `local` | `preview` (in TOML) | `production` (in TOML) |
| `VITE_SUPABASE_PROJECT_ENV` | `local` | `preview` | `production` |
| `VITE_SUPABASE_URL` | local API URL | staging EU project URL | production EU project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | local public key | staging public key | production public key |
| `VITE_PREVIEW_SUPABASE_URL` | unset | pinned staging URL | pinned staging URL |
| `VITE_PRODUCTION_SUPABASE_URL` | unset | pinned production URL | pinned production URL |

Hosted builds require two distinct pinned project URLs and fail if the selected URL does not match the context, even when its environment marker is mislabeled. Unexpected `VITE_*` variables fail validation; browser code refers only to the approved variables. Do not set the Supabase variables in Netlify's shared/all-context scope: use explicit contexts and separate projects. Preview databases contain only fictitious test data. Frontend builds do not apply migrations; apply reviewed migrations separately to the intended Supabase project. `.env.local`, local Netlify state, generated bundles and database runtime files are ignored by Git.

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
