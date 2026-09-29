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


---

## D016 — Member dashboard is personal and member directory is admin-only

**Decision:** the global member directory is visible only to administrators.

Regular members continue to see participant information in the context of a specific session, where it is useful for coordination, but they do not browse the club-wide member list.

The regular-member home dashboard should prioritize information that is directly actionable for that member: response status, published selection status, transport, and payment. Global operational indicators belong to the administrator dashboard.

**Rationale:** regular members need a simpler, more personal interface and should not be exposed to unnecessary club-wide operational information.


---

## D017 — Palanquee level summaries are informational

**Decision:** the palanquee editor shows a dynamic summary of the qualifications / training levels present in the published participant selection, and a live summary for each palanquee while the administrator changes assignments.

The initial summary categories are:

- E3
- E2
- E1
- N4
- N3
- PN3
- PN2
- PN1

For the current prototype data model, MF1 is displayed as E3 in this summary. A member preparing N3 / N2 / N1 is displayed respectively as PN3 / PN2 / PN1 when no higher listed current qualification category applies.

**Important:** these summaries are visual aids for the DP. They do not validate regulatory compliance, required supervision ratios, depth limits, or qualification rules.


---

## D018 — President is the super-admin role

**Decision:** iFosse has three application roles:

- `member` — regular member;
- `admin` — manages sessions, selections, payments, attendance, palanquees and member information;
- `president` — has all admin permissions and is the only role allowed to grant or revoke admin rights.

The prototype keeps exactly one president. The president role itself cannot be removed from the member editor.

**Rationale:** ordinary admins should not be able to escalate privileges or remove each other's rights. Governance of administrator access belongs to the president.


---

## D019 — CACI expiry warnings are advisory

**Decision:** iFosse compares a member's CACI end date with both the current date and the date of a future fosse.

The interface distinguishes:

- valid;
- expires soon (within 60 days);
- expired;
- not entered.

If a member answers Yes to a future fosse where their CACI will be expired, or where no CACI date is entered, the application warns them before saving the response but does not block registration.

Admins see the CACI status for the member list and specifically "on the day" in the session-selection view.

**Rationale:** the member may renew their CACI before the session, so an advisory warning supports follow-up without prematurely blocking registration.
