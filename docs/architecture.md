# MVP architecture freeze

Status: **accepted for implementation**

This document freezes the technical direction for the first shared production version of iFosse. The current standalone HTML prototype remains the functional/UX reference, but it is not the production architecture.

## 1. Goals

The production MVP must:

- serve roughly 50 club members;
- work well on phones and desktop browsers;
- provide real shared state;
- use passwordless authentication;
- enforce permissions outside the browser UI;
- preserve the current session / registration / selection / publication workflow;
- make operational mistakes recoverable;
- stay simple to deploy and maintain.

The system does not need native mobile applications, microservices, a custom identity provider or infrastructure sized for large traffic.

## 2. Chosen stack

### Frontend

- **React + TypeScript**
- **Vite** for the application build and local development
- responsive web application, mobile first
- the V0 visual language may be reused, but the single-file HTML structure is not carried forward

### Backend, database and authentication

- **Supabase**, hosted in an EU region
- managed **PostgreSQL**
- **Supabase Auth**
- **Row Level Security (RLS)** for authorization at the database boundary
- PostgreSQL functions / transactions for business operations that must be atomic

No separate custom API server is required for the MVP unless a concrete need appears that cannot be handled cleanly by database policies/functions.

### Hosting

- **Netlify** for the frontend, using two sites: `ifosse-staging.netlify.app` (primary branch `staging`, application environment `preview`) and `ifosse.netlify.app` (primary branch `master`, application environment `production`)
- preview deployments for pull requests use the staging Supabase project on either site
- all six public environment variables are explicitly configured per site/context; Netlify's primary-deploy `production` context does not determine the application environment
- staging frontend uses `ifosse-staging`; production frontend uses the separate `ifosse-production` Supabase project
- secrets and service-role credentials must never be exposed to the browser

## 3. Authentication

Authentication is deliberately passwordless.

### Sign-in flow

1. The member enters their email address.
2. iFosse sends a one-time magic link.
3. The link signs the member into the web application.
4. The browser keeps a refreshable authenticated session across restarts.
5. The session remains active until explicit sign-out, revocation, or expiry imposed by the authentication provider.

There is no password creation or password reset flow in the MVP.

Magic links should be short-lived and single-use.

### Account provisioning

Open public sign-up is not required.

A member account must correspond to a known club member email. Users are provisioned by the President or a trusted bootstrap/recovery operator, without invitations. The President UI uses a small Supabase Edge Function for the privileged Auth Admin identity creation; ordinary business rules remain transactional SQL/RLS. The authenticated Supabase user is linked 1:1 to an iFosse member profile.

Email addresses are unique.

### Session behavior

The desired UX is a long-lived session on a personal phone/computer. Users should normally not have to sign in again every day.

"Stay signed in" is implemented through the normal refresh-token session mechanism, not through an indefinitely valid access token.

Explicit sign-out clears the local session. Administrative session revocation must remain possible.

## 4. Authorization

Application roles remain:

- member;
- admin;
- president.

Authorization is enforced by RLS policies and transactional database functions, not only by hiding buttons in React.

Examples:

- a member can edit their own normal profile fields, but not their role;
- only admins/president can create or edit sessions;
- only admins/president can edit another member's CACI date;
- an admin/president may edit their own CACI date;
- only admins/president can change payment and attendance;
- only the president can grant or revoke admin rights;
- regular members can see only the data defined as member-visible in the product specification.

The browser must be treated as untrusted.

## 5. Transaction boundaries

The following operations must be atomic database operations rather than a series of unrelated client writes:

- changing session capacity when a draft selection already exists;
- changing draft selection state while enforcing capacity;
- publishing a selection;
- offering/removing a car;
- taking/leaving a passenger seat;
- driver withdrawal and passenger reassignment to unresolved transport;
- publishing palanquees;
- closing/reopening attendance bilan where derived counters depend on attendance.

PostgreSQL constraints and functions are preferred over duplicated client-side checks.

## 6. Data and privacy principles

The MVP stores only data needed for the fosse workflow.

CACI handling is intentionally minimal:

- store only the validity end date;
- do not upload or retain the medical certificate;
- expose the member's own status to that member;
- expose administrative CACI data only to admins/president as required by the workflow.

The MVP does not store uploaded medical, licence or qualification documents.

Production launch requires a final review of privacy notice, retention, backups and administrator access.

## 7. Environments

Use three practical environments:

- **local**: local frontend + local Supabase development stack;
- **preview/staging**: pull-request or shared test deployment with non-production data;
- **production**: real members and club sessions.

Production data must never be copied into public preview deployments.

Database changes are committed as ordered migrations.

## 8. Testing

Minimum automated coverage:

- domain/business tests for registration and selection rules;
- database/RLS tests for permissions;
- transactional tests for capacity and carpool races;
- end-to-end tests for the main member and admin flows.

Suggested toolchain:

- Vitest for TypeScript unit/domain tests;
- Playwright for browser E2E tests;
- integration tests against a local Supabase/PostgreSQL instance for policies and database functions.

## 9. Deployment and operations

The production path is:

GitHub -> CI/tests -> Netlify frontend deployment + Supabase migrations.

Before production:

- database backups must be enabled and recovery documented;
- migrations must be reproducible from an empty database;
- privileged changes should be represented in an audit trail;
- production environment variables and service keys must be separated from preview environments.

## 10. Explicit non-goals

Not part of the production MVP:

- native Android/iOS applications;
- online payments;
- federation/FFESSM integration;
- uploaded CACI or licence documents;
- regulatory palanquee document generation;
- generic club ERP features;
- push notifications;
- complex event/trip management.

These can be revisited after the fosse workflow is running reliably in production.

## Member lifecycle boundary

President-managed access suspension uses `members.disabled_at` and the required Custom Access Token hook; existing JWTs lose RLS/RPC access immediately. Creation verifies the current President before Auth Admin and again in a transactional SQL finalizer. No custom API server, passwords, public signup or client-side service keys are introduced. [Deployment/security details](member-management.md).


## Account notification boundary (D030)

Application identity audit events and effective admin CACI changes transactionally populate a private-by-permission outbox. CACI notifications ask the affected member to check Mon profil, without a validity date or medical document. A scheduled Supabase Edge Function uses Brevo's transactional API with a server-only key and an internal scheduler secret. No browser email sending, SMTP/auth redesign or custom API server. Recipient/environment guards apply independently at enqueue and dispatch; uncertain provider acceptance requires operator review. [Deployment and failure semantics](member-notifications.md).
