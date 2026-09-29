# Product decisions

This file records explicit product decisions so that they do not get lost between conversations, prototypes and implementation changes.

## D001 — Session is the main entry point

**Decision:** iFosse is organized primarily around a diving-pool session.

**Rationale:** the operational problem to solve is session organization, not general club administration.

---

## D002 — All club members have accounts

**Decision:** all club members will have an iFosse account.

**Scale:** approximately 50 users.

---

## D003 — Two practical permission levels for the MVP

**Decision:** use a simple distinction between member and administrator for the MVP.

Administrators cover the current DP / organizer capabilities used by Xavier and TitO.

More detailed federation or instructor role hierarchies can be added later only if a concrete need appears.

---

## D004 — Registrations may exceed capacity

**Decision:** Yes responses are never capped by session capacity.

A session with capacity 20 may have more than 20 Yes responses.

**Rationale:** organizers choose the final participants later and cancellations may occur.

---

## D005 — Final selection is capacity constrained

**Decision:** the administrator's final participant selection cannot exceed the session's current capacity.

Encadrants/instructors consume a place.

If more places are needed, an administrator may edit the session and increase its capacity.

---

## D006 — Selection uses draft + publication

**Decision:** administrator selection changes are prepared as a draft.

Members continue to see the previous published state until an administrator explicitly publishes the draft.

Administrators may later modify and publish again.

**Rationale:** organizers need freedom to work on the list without exposing unstable intermediate decisions.

---

## D007 — Responses are visible to everyone

**Decision:** all members can see who answered Yes / Maybe / No, as in the existing Framadate workflow.

---

## D008 — Season runs September to August

**Decision:** participation counters are calculated per season from 1 September through 31 August.

Example: season 2026–2027 runs from 1 September 2026 through 31 August 2027.

---

## D009 — Attendance drives participation counters

**Decision:** season counters are based on actual validated attendance, not registration or selection.

**Rationale:** late withdrawals and replacements must not distort the history.

---

## D010 — Payment remains trust-based

**Decision:** no online payment workflow is required.

Payment status is administrative information with states such as To pay / Paid / Free.

Members can see their own status.

Only administrators can modify it.

---

## D011 — Carpooling is editable after registration

**Decision:** members may add, change or remove carpool information after their initial session response.

A driver offers a configurable number of passenger seats for a specific session.

If a driver withdraws, passengers remain registered but their transport becomes unresolved.

---

## D012 — Regulatory document generation is deferred

**Decision:** simple palanquee organization may exist in the MVP, but generation and long-term storage of the official regulatory document is deferred to a later version.

---

## D013 — Keep the MVP focused on fosse management

**Decision:** richer member records and general club-management functions are future extensions.

The MVP should not expand into licence/CACI/document management, pedagogical tracking or general ERP features unless explicitly reprioritized.

---

## D014 — V0 is a prototype, not production architecture

**Decision:** `frontend/iFosse_V0.html` is the functional reference for the current flows.

Its single-file/local-storage implementation is not a constraint on the architecture of the production application.


---

## D015 — Car profile defaults are optional

**Decision:** members do not have a car by default in their profile.

A member may opt in to storing usual carpool defaults (passenger seats and meeting point). These values only prefill future session car offers and never create an offer automatically.

A member without a usual car in their profile may still offer a car for a specific session. After doing so, the application may explicitly offer to save those values as profile defaults.

**Rationale:** session transport is the operational truth, while profile car information is only a convenience.
