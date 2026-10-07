# iFosse — Functional specification

## 1. Purpose

iFosse replaces the current Framadate + WhatsApp workflow used to organize the club's diving-pool sessions.

The first objective is not to build a complete club-management platform. It is to make session organization simple, transparent and much less time-consuming.

Approximate user population: **50 club members**.

## 2. Core concept

The main entry point is a **session**.

Each session contains at least:

- date;
- start and end time;
- location/address;
- optional access information;
- capacity;
- registration-open state;
- member responses;
- administrator selection;
- carpool information;
- payment information;
- attendance;
- optional simple palanquee grouping.

Default capacity is typically **20**, but an administrator can modify it at any time.

An instructor/encadrant occupies one of the available places.

## 3. Roles

iFosse uses three application roles: member, administrator and president.

### Member

A member can:

- view sessions;
- answer yes / maybe / no;
- modify their answer;
- see other members' Yes/Maybe answers and their own response status;
- propose or withdraw a car for a session;
- choose or change carpool arrangements;
- see the published participant selection;
- see their own payment status;
- see season participation counts;
- view published palanquees when present.

### Administrator

An administrator can do everything a member can, plus:

- create and edit sessions;
- change session capacity;
- modify member responses when needed;
- prepare the final participant selection;
- publish and re-publish that selection;
- change payment status;
- validate actual attendance;
- close/reopen a session bilan;
- create and publish simple palanquee groups;
- manage member data required by the application.

Xavier and TitO are representative administrator users / DP for the current workflow.

## 4. Registration

Each member has one response per session:

- Yes
- Maybe
- No

The response can be changed at any time.

The number of **Yes** responses is **not limited** by session capacity.

Within a session, the Participants tab shows only members who answered Yes or Maybe. The administrative management view can still expose the broader member population when needed for corrections.

## 5. Final participant selection

Registration and final selection are separate concepts.

Administrators prepare a **draft selection**.

The draft may contain at most the current session capacity.

Example:

- capacity = 20;
- 24 members answered Yes;
- administrator selects 20;
- the 4 others remain non-selected / waiting.

If administrators need 21 participants, they may first edit the session capacity to 21.


### President

The president is a super-admin.

The president has all admin capabilities and can additionally:

- promote a regular member to admin;
- remove admin rights from an admin;
- create an ordinary member (first name, last name, email) who subsequently uses normal magic-link login;
- deactivate/reactivate access with confirmation, while preserving all historical records (D028).

Regular admins cannot change application roles or create/deactivate/reactivate members. Administration uses one searchable directory with row-level actions; members cannot access it. Hard deletion is excluded. [Lifecycle and deployment details](member-management.md).

The MVP/prototype keeps exactly one president. The president role cannot be removed from the member editor.

### Publication

Draft changes are not immediately public.

Administrators must explicitly use a **Publish selection** action.

The last published selection is visible to everyone.

Administrators may later modify the draft and publish again. The newly published state replaces the previously published one.

Suggested selection states:

- Waiting
- Selected
- Not selected
- Withdrawn

The exact UI labels may evolve as long as the underlying distinction remains clear.

## 6. Season and participation counters

A season runs from **1 September through 31 August**.

Example:

- season 2026–2027 = 1 September 2026 to 31 August 2027.

The number of fosses completed by a member during the season is computed from the session history.

A member counts as having completed a fosse only when the administrator validates that the member actually participated.

Being selected is not sufficient.

This count is intended both as an attendance indicator and as useful context when administrators must choose between more volunteers than available places.

## 7. Carpooling

Carpooling is managed per session.

A registered member may later:

- indicate that they are driving;
- define the number of passenger seats offered;
- change or remove that offer.

Other members may choose a car while seats remain.

Rules:

- a driver must participate in the session;
- a car offer exists only for that session;
- passenger capacity must not be exceeded;
- the driver does not consume one of their own passenger seats;
- if the driver withdraws the car or leaves the session, passengers stay registered for the fosse but their transport becomes unresolved.

Carpool choices remain editable after initial registration.

Usual car information in the member profile is optional. Members without a car profile may still offer a car for a specific session.

When a member has usual car defaults, they may include:

- usual passenger-seat count;
- usual meeting point.

These values are used only to prefill a new session car offer. They never create an offer automatically.

If a member without profile car defaults offers a car for a session, the application may explicitly ask whether to save those values to the profile. This must remain opt-in.

## 8. Payments

Payment is trust-based. There is no online payment requirement in the MVP.

Suggested states:

- To pay
- Paid
- Free

Each member can see their own status.

Only an administrator can change it.

## 9. Attendance and session closure

After the session, an administrator validates who actually participated.

Attendance is the source of truth for the season counter.

The administrator can close the session bilan, and may reopen it later to correct an error.

## 10. Palanquees

The MVP may include simple manual grouping into palanquees.

The palanquee editor should also provide a dynamic qualification summary for the published selection and update per-palanquee summaries immediately when assignments change.

The first prototype uses the categories E3, E2, E1, N4, N3, PN3, PN2 and PN1. MF1 is represented as E3 in this display. PN3 / PN2 / PN1 represent members preparing N3 / N2 / N1 respectively.

This summary is informational only and must not be presented as regulatory validation.

These groups can be published and made visible to members.

The MVP does **not** need to generate a regulatory document.

Generating and storing the official regulatory record is a later feature.

## 11. Member profile

All club members have an application account.

For the first production version, the profile should stay small and focused on the fosse workflow.

Useful fields include:

- first name;
- last name;
- email;
- mobile phone;
- current diving level;
- level being prepared;
- application role / rights;
- optional address;
- optional usual car information;
- CACI validity end date, maintained by an administrator and visible read-only to the member.

The following are explicitly considered future club-management extensions rather than MVP requirements:

- licence tracking;
- insurance card;
- uploaded qualification documents;
- emergency contact management;
- training assessments;
- validated competencies;
- broader club administration.

## 12. Authentication

The original requirements mention email/password and possible biometrics.

For the production MVP, authentication uses email magic links.

Rules:

- every real member has their own account linked to a known club email address;
- arbitrary public sign-up is not required;
- no password creation or password-reset flow is required;
- authenticated sessions should persist across browser restarts on personal devices;
- logout opens a confirmation dialog; Annuler/Escape preserves the session, and only explicit confirmation ends the local session;
- administrator permissions must be enforced server-side / at the database boundary;
- account support should remain minimal.

## 13. Visibility

All members may see:

- session information;
- other members' current Yes / Maybe responses (No/unanswered remain own/admin-only under D026);
- published selection;
- published palanquees;
- carpool availability.

The club-wide member directory is not shown to regular members. Participant identities and relevant diving information remain visible within the context of a session.

A member may see their own payment status.

The regular-member dashboard should emphasize the member's own next actions and statuses rather than administrator-oriented global counts.

Administrators may see and edit administrative fields.

## 14. Out of scope for the first production MVP

- online payment;
- full accounting;
- regulatory palanquee document generation;
- complete licence/document management and uploaded medical documents;
- pedagogical skill tracking;
- native Android/iOS applications;
- full ERP-style club management.

## 15. V0 status

The V0 in `frontend/iFosse_V0.html` is a functional prototype used to validate these rules.

It intentionally uses:

- fictitious users;
- fictitious historical sessions for testing;
- local browser storage;
- simulated roles;
- no shared backend.

It must not be treated as secure or production-ready.


## CACI expiry warnings

The member record stores only a CACI validity end date.

The UI should display one of four CACI states:

- Valid;
- Expires soon: validity ends within 60 days of the reference date;
- Expired;
- Not entered.

The club-wide member view uses today's date as the reference.

The session-management view uses the session date as the reference and should show whether each participant's CACI is valid "on the day".

When a regular member answers Yes to a session for which their CACI will be expired, or when no CACI date is available, iFosse shows a warning before saving the response. Registration remains possible after explicit confirmation.


## 16. Session readiness summary

The administrator selection view includes a compact readiness summary for each displayed member.

The first prototype tracks four operational points:

- selection;
- CACI validity on the session date;
- resolved transport;
- payment status.

This is an operational checklist, not a regulatory fitness assessment.

## 17. School holidays

A session may be marked by an administrator as taking place during school holidays.

When marked, the session displays a visible "Vacances scolaires" badge.

The prototype stores this as an explicit session flag rather than attempting to infer school-holiday dates automatically.

### Participant list sorting

The Participants tab retains only Yes/Maybe responses and offers compact client-side
sorting, separate from the management search. Default: **Inscription**, oldest
first, even after publication. The preference (criterion/direction) lives only
in browser session storage; it survives navigation/reload, with no server preference.
Choosing another criterion starts ascending.

- **Nom**: French alphabetical last name, then first name.
- **Niveau**: display order `Débutant/N0, N1, N2, N3, N4, N5, E1, E2, E3, MF1, E4, MF2`.
  Current level is free text; trim/case are normalized for sorting (Débutant/
  Debutant uses the same rank as N0). This is a
  deterministic display convention, not an equivalence of diving/teaching qualifications.
  Level being prepared is ignored. Other/missing levels remain last in either direction.
- **Sélection**: effective published status only: Confirmé, En attente,
  En attente de publication, Non retenu, Désisté, Sans participation; unknown status last.
  Reverse reverses groups only, preserving oldest-first within each group.
- **Inscription**: first Yes/Maybe timestamp, retained across response changes,
  withdrawal/rejoin and operational edits. The new `registered_at` field is projected
  by `get_current_selection` without broadening its existing visibility rules.
  Existing registrations have no reliable historical timestamp and stay unknown;
  unknown/invalid dates remain last in both directions and a note explains this.

For ties: registration ascending, then name ascending, then stable member UUID.
For name sorting, last/first name form the primary key. All sorts leave loaded
records unchanged. No new search/filter or private draft visibility is introduced.
Hosted deployments need migration `20261006020000_participant_registration.sql`
before the frontend to enable chronological tracking; this task does not deploy it.
