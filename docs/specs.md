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

### Member

A member can:

- view sessions;
- answer yes / maybe / no;
- modify their answer;
- see other members' answers;
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

All members can see who answered Yes / Maybe / No, similarly to the current Framadate workflow.

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
- optional usual car information.

The following are explicitly considered future club-management extensions rather than MVP requirements:

- licence tracking;
- CACI;
- insurance card;
- uploaded qualification documents;
- emergency contact management;
- training assessments;
- validated competencies;
- broader club administration.

## 12. Authentication

The original requirements mention email/password and possible biometrics.

For the production MVP, authentication should be simple for non-technical users. Exact implementation remains an architectural decision.

Whatever mechanism is chosen:

- every real member has their own account;
- administrator permissions must be enforced server-side;
- long-lived authenticated sessions on personal devices are desirable;
- password recovery / account support should be minimal.

## 13. Visibility

All members may see:

- session information;
- Yes / Maybe / No responses;
- published selection;
- published palanquees;
- carpool availability.

A member may see their own payment status.

Administrators may see and edit administrative fields.

## 14. Out of scope for the first production MVP

- online payment;
- full accounting;
- regulatory palanquee document generation;
- complete licence/CACI/document management;
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
