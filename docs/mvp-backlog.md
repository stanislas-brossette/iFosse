# Production MVP implementation backlog

This backlog turns the validated V0 into the shared multi-user application. Each slice should be deployable and testable before moving to the next one.

## Slice 0 — Repository foundation

Deliverables:

- React + TypeScript + Vite application scaffold;
- Supabase local development configuration;
- database migration directory;
- generated database types;
- lint/typecheck/test scripts;
- CI on pull requests;
- Netlify preview deployment;
- environment variable separation.

Acceptance:

- a fresh clone can start frontend + local database from documented commands;
- CI passes on an empty functional shell;
- no production secret is present in the repository or browser bundle.

## Slice 1 — Authentication and member identity

Deliverables:

- known-member email provisioning/import;
- email magic-link login;
- persistent refreshable browser session;
- explicit logout;
- members table linked to auth users;
- member/admin/president RLS;
- president-only role management.

Acceptance:

- no open arbitrary sign-up;
- known member can sign in without a password;
- session survives browser restart;
- logged-out user cannot read club data;
- member cannot self-promote;
- admin cannot grant admin;
- president can grant/revoke admin.

## Slice 2 — Profiles and CACI

Deliverables:

- minimal member profile;
- own profile edit for ordinary fields;
- CACI date visibility;
- admin CACI editing, including own CACI;
- usual car defaults;
- admin-only member directory.

Acceptance:

- regular member cannot browse the global directory;
- member sees own CACI status;
- regular member cannot edit CACI;
- admin can edit CACI for self and other members.

## Slice 3 — Sessions and registrations

Deliverables:

- season/session calendar;
- session creation/edit/delete by admin;
- capacity and school-holiday flag;
- Yes / Maybe / No registration;
- Participants tab limited to Yes/Maybe;
- CACI warning when registering for a session where it will be missing/expired.

Acceptance:

- Yes registrations may exceed capacity;
- member can change response;
- regular member cannot create/edit sessions;
- session data is shared live between different accounts/devices.

## Slice 4 — Draft selection and publication

Deliverables:

- admin draft selection;
- grouped Confirmed / Waiting / Not selected management view;
- capacity enforcement;
- immutable publication snapshots;
- re-publication;
- member-visible latest publication.

Acceptance:

- selected count cannot exceed capacity, including concurrent attempts;
- selected requires RSVP Yes;
- draft is invisible to regular members;
- previous publication remains visible until the next publication succeeds;
- publication is atomic.

## Slice 5 — Carpooling

Deliverables:

- offer/remove car;
- profile defaults as prefill only;
- passenger join/leave;
- unresolved-transport behavior;
- seat-count transaction.

Acceptance:

- car cannot exceed passenger capacity even under concurrent joins;
- driver does not consume a passenger seat;
- removing driver/car does not unregister passengers;
- displaced passengers become unresolved.

## Slice 6 — Payments and readiness

Deliverables:

- unpaid / paid / free status;
- member sees own payment;
- admin edits payment;
- admin readiness summary: selection / CACI / transport / payment.

Acceptance:

- regular member cannot see another member's payment status;
- regular member cannot change payment state;
- readiness is derived rather than stored.

## Slice 7 — Attendance and season counters

Deliverables:

- attendance entry;
- close/reopen bilan;
- September-August season counters;
- completed-session history.

Acceptance:

- selection alone does not increment season count;
- only validated attendance contributes;
- season boundary behavior is tested.

## Slice 8 — Palanquees

Deliverables:

- draft palanquee assignments;
- dynamic level summary;
- publish/re-publish;
- member-visible latest publication.

Acceptance:

- only currently published selected members can be assigned;
- published groups remain visible while a new draft is edited;
- no feature claims regulatory validation.

## Slice 9 — Production hardening and real-data rollout

Deliverables:

- audit events for privileged changes;
- backup and restore procedure;
- privacy/retention review;
- real member import;
- real 2026-2027 session import;
- staging test with organizers;
- production deployment;
- short operator guide.

Acceptance:

- restore procedure has been tested;
- real admins can complete the full session workflow on a phone;
- important admin mutations are traceable;
- one full trial fosse can be run in iFosse while legacy tools remain as fallback.

## MVP launch exit criteria

The MVP is ready to replace Framadate for fosse management when:

- all real users can authenticate reliably;
- permissions are enforced at the database boundary;
- registrations, selection, publication, carpooling, payment, CACI, attendance and palanquees work across devices;
- concurrency cannot overbook selection capacity or car seats;
- organizers can recover from common mistakes;
- backups and restore are documented;
- mobile operation is practical for the common admin flows.

Features explicitly deferred until after this milestone remain deferred unless a production-blocking need is discovered.
