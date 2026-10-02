# MVP execution status

## #9 — Repository foundation

The production application is a separate React + TypeScript + Vite scaffold. The V0 reference is unchanged. The repository includes a pinned npm lockfile, local Supabase configuration, a deny-by-default bootstrap migration, database tests, generated schema types, PR CI and Netlify build configuration.

Local verification and PR/CI evidence are recorded in the issue's PR. The shell has no domain tables, fake identities or member data. Following slices explicitly grant database access after adding RLS policies and protected transactional operations.

**External blocker:** no existing iFosse Netlify project was returned by the connected account. A repository-linked site, a separate staging EU Supabase project, and explicitly scoped public preview variables are needed to demonstrate a PR deploy preview. Configuration has been prepared; no preview or production deployment is claimed. #9 remains open until preview deployment is verified. Implementation of independent later slices continues.

## #18 — Launch gate

Real member import, hosted authentication delivery, organizer pilot, production deployment and privacy/retention sign-off require the actual project environments and organizer involvement. Do not close #18 merely because configuration and operator procedures are committed. The handoff requires a tested restore and a validated trial session before completion.
