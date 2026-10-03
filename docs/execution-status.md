# MVP execution status

## #9 — Repository foundation

The production application is a separate React + TypeScript + Vite scaffold. The V0 reference is unchanged. The repository includes a pinned npm lockfile, local Supabase configuration, a deny-by-default bootstrap migration, database tests, generated schema types, PR CI and Netlify build configuration.

Local verification and PR/CI evidence are recorded in the issue's PR. The shell has no domain tables, fake identities or member data. Following slices explicitly grant database access after adding RLS policies and protected transactional operations.

**External blocker:** no existing iFosse Netlify project was returned by the connected account. A repository-linked site, a separate staging EU Supabase project, and explicitly scoped public preview variables are needed to demonstrate a PR deploy preview. Configuration has been prepared; no preview or production deployment is claimed. #9 remains open until preview deployment is verified. Implementation of independent later slices continues.

## #10 — Authentication and identity

Known-member provisioning defaults to offline validation and sends no invitations. Authentication uses an explicit confirmation step, persistent refreshable sessions and local logout. Profiles are protected by own/admin RLS, with no browser table mutations. President-only role operations and service-only presidency bootstrap/recovery are serialized and audited. See [authentication](authentication.md) for setup and recovery.

Hosted SMTP deliverability and real organizer accounts are rollout gates rather than claims made by local Auth/browser/database tests.

## #11 — Profiles and CACI

Members edit names, phone, current/preparing levels and optional car defaults. They see their own CACI date/status without a date-edit control. Administrators/president edit CACI for self and others, with an audit event; the global directory remains own/admin RLS-protected. CACI status uses the Paris calendar day and an inclusive 60-day warning window. Sign-in email remains an operator-managed identity field; the V0's ordinary email edit is not carried into an uncoordinated Auth/profile write.

## #18 — Launch gate

Real member import, hosted authentication delivery, organizer pilot, production deployment and privacy/retention sign-off require the actual project environments and organizer involvement. Do not close #18 merely because configuration and operator procedures are committed. The handoff requires a tested restore and a validated trial session before completion.

## #12 — Sessions and registrations

The shared season calendar uses September–August bounds. Admins create, edit and explicitly confirm deletion of sessions, mark holidays manually, set capacity and open/close registration. Members change Yes/Maybe/No responses; Yes is never capacity-limited. Closing registration still permits withdrawal; a closed attendance bilan requires reopening before changing responses, matching the reference.

CACI warnings compare with the session date and require explicit confirmation, including when the date changes between page load and save. They remain advisory. The regular Participants tab filters to Yes/Maybe. A scoped response RPC exposes only participant names, levels and response; the mixed operational participation table remains readable only by self/admin. Shared calendar/detail views refresh every five seconds while visible and on focus, without exposing a private operational table through Realtime.

## #13 — Draft selection and publication

The admin management tab groups Confirmed / Waiting / Not selected, initializes from the publication, and supports abandoning a draft or explicitly confirming publication. Members keep seeing the latest successful published version while admins work. A locked transaction creates an immutable version with its audit event. Capacity reduction respects both draft and effective published selection, including instructors; concurrent changes cannot overbook.

Withdrawal preserves historical snapshots and releases the current place. Re-registering does not resurrect a prior confirmation. Tests cover private draft RLS, immutable content, publication rollback after an injected audit failure, republishing, session deletion, parallel final-place selection, a parallel capacity reduction/selection and parallel publication.

## #14 — Transactional carpooling

The Covoiturage tab supports explicit offers with 1–8 passenger seats, profile defaults as prefill, editing/removal, taking/changing/leaving a seat, and manual transport preferences. A member without defaults can still offer a car. Removing an occupied car explains passenger displacement before confirmation. Shared views expose offered rendezvous details and participant names, without private profile fields.

Database tests cover seat limits, driver exclusion, failed-switch preservation, one car per passenger/session, cross-session rejection, closed bilan, driver withdrawal, private versus published selection exclusion and default-only profiles. Concurrent HTTP tests exercise the last seat and withdrawal versus join; passengers remain registered and can choose another transport.

## #15 — Payments and operational readiness

Members read their own unpaid/paid/free status. Administrators/president change payments through an audited, role-checked RPC, including corrections after closure. The admin selection view derives its checklist from the draft/publication, CACI on the session date, transport and payment. It stores no independent readiness flag and explicitly disclaims medical/regulatory validation. Public projections omit payment.

## #16 — Attendance, bilan and season history

The Bilan tab supports actual attendance after the Paris-local session end, closure after presence/capacity checks, and explicit reopening for corrections. Reopening retains attendance and keeps registration closed. Only actual dives in closed bilans count for the September–August season; the member overview, selection context and completed-bilan history refresh across accounts. SQL and browser regressions cover boundary dates, replacement attendance, permissions, audit rollback, concurrent closure/correction and reopening counts.

## #17 — Palanquée publication

The Palanquées tab provides private manual assignments, optional informational encadrant flags, immediate group/selection level summaries, explicit versioned publication and abandonment of drafts. Members see the latest successful publication while a new draft is edited. Publications retain their source selection; selection changes require review and withdrawn assignments disappear from the effective view without altering history. Current profile levels refresh summaries, and unclassified profiles remain in the total. No regulatory validation or document generation is claimed.
