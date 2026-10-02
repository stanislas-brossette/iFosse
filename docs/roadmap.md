# iFosse roadmap

The roadmap is intentionally incremental. The goal is to validate the product before investing in infrastructure or broad club-management features.

## V0 — Functional prototype

**Status:** available.

Purpose:

- validate the session workflow;
- validate roles and visibility;
- validate registration vs selection;
- validate publication semantics;
- validate carpooling;
- validate payment status;
- validate attendance and season counters.

Current implementation:

`frontend/iFosse_V0.html`

Limitations:

- local only;
- demo identities;
- no backend;
- no real authentication;
- no shared state;
- no real authorization;
- no production-grade concurrency handling.

## V0.1 — Organizer feedback

Primary reviewers:

- Xavier
- TitO
- Alain

Goals:

- collect concrete usability feedback;
- identify missing rules;
- simplify unclear screens;
- correct wording and terminology;
- confirm which V0 functions are truly required for the MVP;
- confirm uncertain session/calendar details.

Exit criterion:

The organizers agree that the workflow is understandable and reflects how they actually run a fosse.

## V0.2 — Product freeze for MVP

**Status:** architecture frozen; ready to implement.

Deliverables:

- consolidated product scope in `docs/specs.md`;
- explicit product decisions in `docs/decisions.md`;
- production architecture in `docs/architecture.md`;
- initial relational model in `docs/data-model.md`;
- implementation slices and acceptance criteria in `docs/mvp-backlog.md`.

Frozen technical direction:

- React + TypeScript + Vite;
- Supabase PostgreSQL/Auth/RLS in an EU region;
- passwordless email magic-link login with long-lived refreshable sessions;
- Netlify frontend hosting and preview deployments.

## V0.3 — Shared technical foundation

Goals:

- create the real application structure;
- add backend/API or equivalent server-side layer;
- add shared persistent database;
- add migrations;
- add server-side authorization;
- add automated test setup;
- add deployment configuration.

No broad feature expansion at this stage.

## V0.4 — Real accounts and club data

Goals:

- invite/import real club members;
- implement real authentication;
- support member/admin permissions;
- manage minimal member profiles;
- migrate/create the real 2026–2027 season calendar.

Security requirement:

No administrative rule may rely only on the client UI.

## V0.5 — Production fosse workflow

Goals:

- real registration;
- real published selection;
- editable capacity;
- carpooling;
- payment status;
- attendance;
- season counters;
- simple palanquee publication;
- mobile-responsive UI.

This is the first version intended for actual club operation.

## V0.6 — Reliability and operations

Goals:

- backups;
- auditability of important admin changes;
- safe concurrent updates;
- operational monitoring;
- export tools;
- account recovery/support flow;
- privacy/data-retention review.

## V1 — Club-ready stable release

Candidate exit criteria:

- organizers can run a full season without Framadate;
- routine WhatsApp coordination is significantly reduced;
- all common session-management tasks work from a phone;
- administrative permissions are enforced server-side;
- session history and attendance are durable;
- recovery from mistakes or data loss is documented.

## Later possibilities

Only after V1 proves useful:

- regulatory palanquee document generation and retention;
- notifications/reminders;
- richer licence/insurance tracking and uploaded documents;
- emergency contacts;
- qualification documents;
- training feedback and skill validation;
- broader club trip/event management;
- other APSAP club-management functions.

These are opportunities, not current commitments.
