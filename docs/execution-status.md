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
