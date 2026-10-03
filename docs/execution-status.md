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

## #18 — Prepared rollout work and remaining external gates

Local full-database restoration is now actually tested with populated fictitious Auth/member/session/payment/selection/carpool/palanquée/attendance/audit data. The drill restores into a separate database, preserves ownership/RLS, exercises correction after recovery, verifies the source is unchanged and removes its private backup/fixtures. CI runs the drill. Real calendar import has offline validation, explicit target URL, stable provenance/fingerprint, transactional retry and audit; it excludes fictitious V0 history and registrations. Hosted config pins distinct project URLs and whitelists browser variables. Operator, recovery, privacy and pilot documentation records the remaining actions.

An integrated browser test completes creation, member RSVP/CACI confirmation, carpool, selection, payment, group publication, attendance, closure and reopening/correction with two fictitious accounts in 390 px phone viewports. The actual calendar CLI creates all 11 source sessions locally and retains all 11 on retry; test sessions are then removed. Selection header protections now cover identity, timestamp and publisher provenance as well as content/version, with trusted member-erasure compatibility tested.

**External blockers reconfirmed on 2026-10-03:** the connected Netlify account returns no iFosse project; no staging/production Supabase environment, hosted SMTP verification, real roster or organizer pilot evidence is available here. Actual hosted restore/reconfiguration, production/preview isolation, member import, deployment, privacy/retention sign-off and one complete real trial remain unverified. #9 remains open for the actual PR preview. #18 remains open; local tests do not stand in for organizer acceptance.

## Independent review — R1 auth renewal

A real SDK token refresh reproduced loss of the open profile/unsaved input. Auth renewal now keeps the same member application mounted while rechecking access. Logout, identity change and an unavailable/revoked profile clear the application; identity generations and request ordering prevent late initial/profile/focus responses from restoring a previous account. Three component regressions cover renewal, access loss and account races; a real browser regression refreshes a token, preserves and saves unsaved input, then signs out and switches accounts without retaining the old form. No database or authorization policy changes.

## Independent review — R2/R4 session coordination

Response changes that release a published place or an occupied car now describe those consequences before saving, for both the member and admin correction flow. A preflight RPC is own/admin-only; the write repeats the check under the session lock to catch intervening passenger/selection changes. Cancellation leaves RSVP, publication and car seats unchanged. Confirmation retains the existing transactional cleanup and passenger registration.

The Participants list combines only Yes/Maybe responses with published selection status. Carpool/groups/bilan receive a small personal summary rather than an unrelated full selection list. D026 makes the review's recommended minimization explicit: separate member/admin response projections, own withdrawal status, and consistent direct historical selection/group RLS. Immutable snapshots and attendance-history rules remain intact.

## Independent review — R3/R5 carpool and readiness

A new database regression reproduced false full readiness for a confirmed/paid/CACI-valid passenger whose driver was waiting. D027 now documents one consistent private-draft/published basis for the admin checklist and its driver dependency. Public car cards/trips use only published driver confirmation and visibly remain provisional until publication; private drafts do not change public cards. Existing passenger booking and displacement semantics remain transactional.

The offer form opens only after “Proposer une voiture”. A successful new offer without saved defaults presents explicit accept/decline; the session offer survives declining, and borrowed cars do not silently overwrite defaults. A narrow own-profile RPC updates only opted-in seats/meeting point, preserving unrelated fields and never creating future offers. Profile refresh shows committed defaults while retaining unsaved fields. Operator docs explain initial levels/CACI population and the narrower current directory maintenance scope; physical organizer UX acceptance remains a launch gate.
