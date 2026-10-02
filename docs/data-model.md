# Production MVP data model

This document defines the initial relational model for the shared iFosse application. Names are logical and may receive minor SQL naming adjustments during implementation, but the domain boundaries should stay stable.

## 1. members

One row per club member.

Fields:

- id (uuid, primary key)
- auth_user_id (uuid, unique, references Supabase auth user; nullable until invited/activated)
- first_name
- last_name
- email (unique)
- phone (optional)
- current_level
- preparing_level (optional)
- role: member | admin | president
- caci_expiry_date (date, optional)
- has_usual_car
- usual_passenger_seats
- usual_meeting_point
- created_at
- updated_at

Rules:

- exactly one active president is expected for the MVP;
- only the president changes application roles;
- members can see their own CACI date;
- admins/president can edit CACI dates, including their own;
- no CACI document is stored.

Production profile writes use a self-only ordinary-field RPC and a separate admin-only CACI RPC. Sign-in email is managed with the provisioned Auth identity, not changed by the ordinary profile form. Profile car defaults never create a session car offer.

## 2. sessions

One row per fosse session.

Fields:

- id
- date
- start_time
- end_time
- title
- venue
- address
- notes
- capacity
- registration_open
- school_holiday
- status: open | closed
- end_time_estimated
- created_by
- created_at
- updated_at

Capacity applies to the selected participants, not to Yes registrations.

## 3. session_participations

One row per member/session pair.

Fields:

- session_id
- member_id
- rsvp: unanswered | yes | maybe | no
- payment_status: unpaid | paid | free
- attendance_status: unknown | dived | absent | not_dived
- transport_mode: unset | needs | own | driver | passenger
- car_offer_id (nullable)
- updated_at

Primary key: (session_id, member_id).

This table holds the member's operational state. It does not hold the published selection snapshot.

## 4. selection_draft

Current admin working selection.

Fields:

- session_id
- member_id
- state: waiting | selected | declined
- updated_by
- updated_at

Primary key: (session_id, member_id).

Rules:

- selected is allowed only for a Yes registration;
- selected count may not exceed the current session capacity;
- draft changes are invisible to regular members.

## 5. selection_publications

Immutable publication header.

Fields:

- id
- session_id
- version
- published_by
- published_at

Unique: (session_id, version).

## 6. selection_publication_members

Immutable snapshot of one published selection.

Fields:

- publication_id
- member_id
- state: waiting | selected | declined

Primary key: (publication_id, member_id).

The latest publication is the member-visible source of truth. Publishing creates a new snapshot transactionally; it never mutates an old publication.

This gives explicit support for re-publication and later audit/history.

## 7. car_offers

One car proposal for one driver on one session.

Fields:

- id
- session_id
- driver_member_id
- passenger_capacity
- meeting_point
- departure_time (optional)
- note (optional)
- created_at
- updated_at

Unique: (session_id, driver_member_id).

Rules:

- driver must have RSVP Yes;
- offered seats exclude the driver;
- capacity is 1..8;
- a driver withdrawal removes the offer and atomically moves passengers to unresolved transport.

## 8. car_passengers

Seat assignment.

Fields:

- car_offer_id
- member_id
- joined_at

Primary key: member_id per session through a constraint/queryable invariant; a member cannot occupy two cars for the same session.

Seat assignment must be transactional so two users cannot take the last seat simultaneously.

## 9. palanquee_draft

Current unpublished palanquee assignment.

Fields:

- session_id
- member_id
- group_number
- is_leader
- updated_by
- updated_at

Only members in the current published selected set may be assigned.

## 10. palanquee_publications

Immutable publication header.

Fields:

- id
- session_id
- version
- published_by
- published_at
- selection_publication_id

The referenced selection publication records which selected population the palanquees were built from.

## 11. palanquee_publication_members

Fields:

- publication_id
- member_id
- group_number
- is_leader

Primary key: (publication_id, member_id).

Published palanquees are visible to members. Qualification summaries are derived from member profile levels and remain informational only.

## 12. audit_events

Small append-only audit trail for important privileged actions.

Fields:

- id
- actor_member_id
- session_id (optional)
- target_member_id (optional)
- event_type
- payload (jsonb, minimal)
- created_at

Initial audited events should include at least:

- role changes;
- session create/delete/capacity changes;
- selection publication;
- CACI date changes;
- payment changes;
- attendance/bilan close/reopen;
- palanquee publication.

The audit table is not intended to become a general event-sourcing system.

## 13. Derived values

Do not persist values that are reliably derived:

- season participation count = closed/validated attendance history;
- CACI status = caci_expiry_date relative to today or session date;
- readiness = selection + CACI + transport + payment;
- remaining car seats = passenger_capacity - passenger count;
- current published selection = latest selection publication;
- current published palanquees = latest palanquee publication.

## 14. Main integrity constraints

Database-level constraints/functions must guarantee:

- unique member emails;
- valid enum values;
- no selection above session capacity;
- selected implies RSVP Yes;
- driver implies RSVP Yes;
- no overbooked car;
- no member in more than one car for the same session;
- no palanquee assignment outside the published selected population;
- attendance is the only source used for season completion counts;
- admin-only and president-only writes are protected independently from the UI.

## Implemented session boundary

Session mutations and RSVP changes lock the session row. The `session_participations` table is private to self/admin because it also contains payment and attendance. `get_session_responses(session_id)` is the member-visible projection, restricted to that session's recorded responses and names/levels only. It never exposes directory email, phone, CACI or payment columns. No/unanswered responses are excluded from the regular Participants UI, while administrators can correct all members' responses.

`rsvp_revision` changes only when a response changes. Later immutable selection snapshots can use it to prevent a withdrawn member from regaining a previously published place merely by answering Yes again. Session deletion cascades its operational rows; append-only audit events keep the original deleted UUID in their minimal payload.

## Implemented selection boundary

`selection_drafts` is a private header distinguishing an active empty draft from the absence of a draft. Its rows and `selection_draft` are admin-only under RLS. Draft initialization copies the last publication and normalizes released places to Waiting. Mutation, capacity changes, publication and withdrawal serialize through the session row; database triggers also enforce selected ⇒ Yes and the current capacity.

Publication atomically appends a version/header, member snapshot, and audit event, then consumes the draft. A failure rolls back all four changes. Snapshot member rows include the RSVP revision at publication. `get_current_selection` derives effective selection from the latest snapshot plus the current response/revision; withdrawals release places without editing history, and a subsequent Yes waits for an explicit new administrator selection. Raw historical snapshot rows intentionally preserve the earlier decision.

Publication content cannot be updated or independently deleted. Deleting the entire session cascades its publications, and trusted member erasure can cascade that member's identifiers; minimal audit events remain. The live projection returns its publication version/identifier and effective member states from one database snapshot, avoiding a mixed old-state/new-header display during publication. It exposes only names, diving levels, responses and effective selection, with no email, CACI, payment or draft fields.
