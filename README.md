# iFosse

iFosse is a small web application for organizing APSAP diving-pool ("fosse") sessions.

The project started as a replacement for the current Framadate + WhatsApp workflow used to coordinate registrations, participant selection, carpooling, payments and attendance.

## Current status

The repository currently contains a **V0 functional prototype** in:

`frontend/iFosse_V0.html`

The V0 is a standalone HTML application intended for functional validation only:

- no server;
- no real authentication;
- no shared database;
- demo users and demo data;
- local browser persistence only.

It is useful for validating workflows with club organizers before implementing the real multi-user version.

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
