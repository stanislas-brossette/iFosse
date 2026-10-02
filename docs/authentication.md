# Authentication and member provisioning

Members sign in with a known club email and a single-use magic link. There is no public signup, password creation or password-reset UI. Application roles are read from the database for every authorized operation; Auth metadata and cached JWT role claims do not grant club permissions.

## Local verification

Start/reset Supabase using the README commands. Local mail is captured by Mailpit at `http://127.0.0.1:54324`; it is not sent to real recipients. `npm run test:e2e` provisions and removes fictitious `example.test` accounts against the local stack only. It tests actual email delivery, a scanner GET, a different browser, browser restart, logout, link replay, provider-enforced expiry and disabled public signup. `npm run db:test` tests direct SQL/RLS/RPC authorization, stale roles and presidency operations.

Use `npm run db:reset` rather than a bare CLI reset: start and reset must use the same localhost-bound Docker network or the Auth service loses database DNS access.

## Import known members

Prepare a private JSON file outside the repository:

```json
[
  { "email": "camille@example.test", "first_name": "Camille", "last_name": "Bernard" }
]
```

Only these three fields are accepted. The whole roster is validated before any writes. Roles, CACI and documents are not imported by this command.

```sh
npm run members:import -- /private/path/members.json
```

This is an offline dry run. For an actual import, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in a secure operator terminal, verifying the intended local/staging/production project first. Never put these credentials in a `VITE_` variable, command argument, source file, browser, screenshot or chat.

```sh
npm run members:import -- /private/path/members.json --apply
```

The operator creates email-confirmed Auth identities without passwords or invitations and links them through a service-only database function. No email is sent by import. New profiles always start as members. Re-imports preserve profile edits and existing roles. Existing Auth users are resolved across all pages.

Auth creation and database linking are separate transactions. If linking fails, the script keeps the Auth identity and stops with an entry number; retry the same roster after fixing the cause. An unlinked Auth identity has no club-data access. The script never deletes existing accounts or overwrites profiles to recover an import.

## Presidency and administrator rights

The first president is chosen explicitly by a trusted operator using an already linked member UUID:

```sh
npm run president:manage -- bootstrap MEMBER_UUID
npm run president:manage -- bootstrap MEMBER_UUID --apply
```

Bootstrap is allowed only once and is audited. There is no automatic promotion when the president is missing. A unique database index prevents two presidents. The signed-in president can grant/revoke ordinary administrator rights in the UI; admins and members cannot do so through either table writes or RPCs. The member editor cannot remove the president.

The current president can transfer presidency using the protected `transfer_presidency` RPC; the former president becomes an admin. If the account is unavailable, the trusted operator uses the separate audited recovery path:

```sh
npm run president:manage -- recover MEMBER_UUID --reason "Detailed reason for this operator recovery"
npm run president:manage -- recover MEMBER_UUID --reason "Detailed reason for this operator recovery" --apply
```

The commands default to validation only. Recovery requires a reason of 20–500 printable characters and an active, linked target. The recovery reason must contain only operational context, not sensitive member information. Verify the new president can sign in before disabling the previous account.

## Hosted Auth configuration

Configure staging and production independently; local TOML does not configure hosted projects.

1. Disable public and anonymous signup while keeping the email authentication provider enabled. Locally, the global `auth.enable_signup=false` blocks creation; the email section remains enabled so known members can sign in. Use the member import rather than public registration.
2. Set the project Site URL and explicitly allow each application's `/auth/confirm` redirect URL. Only staging should allow deploy-preview URLs. Avoid broad wildcards for unrelated hosts.
3. Install `supabase/templates/magic-link.html` as the Magic Link email template, and set the subject to “Votre lien de connexion à iFosse”. Set email OTP expiry to 600 seconds.
4. Configure SMTP for club recipients and disable link tracking. Verify deliverability, provider limits, expired/reused links and real email scanners with organizers before launch.
5. Keep refresh-token rotation enabled. Choose provider session limits suitable for personal devices; never make access tokens indefinitely valid.

The template targets the application with a token hash in the URL fragment. The app removes it from the visible URL and verifies it only after “Se connecter” is clicked. Ordinary scanner GETs do not consume the link, and a second browser needs no verifier from the browser that requested it. An advanced scanner that clicks interactive buttons remains a provider/rollout test concern.

The SDK persists and refreshes the session across normal browser restarts. “Se déconnecter” clears this device's session and revokes its refresh token. Existing access tokens can remain valid until expiry; deleting/unlinking/banning the Auth account or revoking an application role stops the corresponding club access immediately through database authorization. For a lost device, use Supabase account/session revocation and, if immediate club blocking is required, ban the account until support resolves it. Do not share accounts.

No hosted deliverability, production deployment or organizer trial is claimed by local tests. These remain launch gates in #18.

References: [Supabase passwordless email authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless), [email templates and scanner handling](https://supabase.com/docs/guides/auth/auth-email-templates), [database RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
