# AGENTS.md

## Project

iFosse is a web application for managing diving-pool sessions for APSAP.

The immediate objective is to turn the current V0 prototype into a small, reliable, shared multi-user application for approximately 50 club members.

## Source of truth

Before changing behavior, read:

1. `docs/specs.md` — consolidated functional specification.
2. `docs/decisions.md` — explicit product decisions already made.
3. `docs/roadmap.md` — sequencing and scope.
4. `docs/cahier_des_charges.md` — original requirements.
5. `docs/iFosse_V0_guide.md` — current V0 behavior and test scenarios.

When documents conflict, prefer in this order:

1. `docs/decisions.md`
2. `docs/specs.md`
3. `docs/cahier_des_charges.md`

Do not silently invent or change product rules. If a requested implementation conflicts with existing decisions, call that out in the PR description.

## Current implementation

The current prototype is:

`frontend/iFosse_V0.html`

It is a standalone, local-only HTML application. Treat it as a functional reference, not as the required long-term architecture.

## Product constraints

- Around 50 club members.
- A session is the central object.
- Typical session capacity is 20, but administrators can change it.
- Registrations are not capped at capacity.
- Final participant selection is capped by the session's current capacity.
- Instructors count toward capacity.
- Member response states are distinct from final selection states.
- Administrators edit a draft selection and explicitly publish it.
- Published selection is visible to all and can later be replaced by a new publication.
- Payment status is visible to the member concerned and editable only by an administrator.
- Carpool information is editable after registration.
- If a driver withdraws, passengers stay registered but need transport reassignment.
- Season counters run from September through August.
- Attendance, not selection, is the basis for season participation counts.
- The first production version does not need regulatory palanquee document generation.

## Engineering guidelines

Prefer boring, maintainable technology over cleverness.

Favor:

- simple architecture;
- explicit domain models;
- server-side authorization;
- predictable migrations;
- transactional writes where capacity or carpool seats can race;
- automated tests for business rules;
- responsive mobile-first UI;
- accessible controls and readable French labels.

Avoid:

- duplicating business rules in multiple UI components;
- relying on client-side authorization;
- silently changing published selection state;
- over-generalizing for hypothetical future club-management features.

## Testing expectations

At minimum, tests should cover:

- registration beyond capacity;
- selection cannot exceed current capacity;
- capacity change behavior;
- draft vs published selection;
- re-publication;
- admin-only payment changes;
- attendance affecting season counters;
- September-to-August season boundaries;
- carpool seat limits;
- driver withdrawal;
- role-based permissions.

When fixing a bug, add a regression test whenever practical.

## PR expectations

Every PR should explain:

- what changed;
- why;
- user-visible impact;
- data-model or migration impact;
- tests performed;
- any remaining limitations.

Keep PRs focused. Prefer several small PRs over one broad rewrite.
