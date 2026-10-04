# Local shared-app acceptance

Use fictitious accounts only. Requirements: Node 22.12+, npm and Docker. Run from the repository root:

```sh
npm ci
npm run db:start
# For a fresh/reset development database only (deletes local data):
npm run db:reset
npm run local:setup
node scripts/with-local-env.mjs npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

The wrapper reads only the local public frontend configuration; no manual key copying is needed. Open http://localhost:5173 and request a magic link. Captured messages appear at http://127.0.0.1:54324; they are not delivered to real recipients.

- `organisateur@example.test`: intentionally **president**, including admin operations and role management.
- `membre@example.test`: definitely **member**, CACI read-only and no global directory.

Use a private/second browser for the member. Check the identity before comparing permissions; log out before switching accounts in one browser. `local:setup` can be repeated without resetting sessions/profiles: it restores the member role through the audited president RPC. If you promote this test member in role management, it has admin capabilities until demoted or setup reruns. The script never replaces an unrelated president and refuses a non-local API.

Create future sessions in the organizer UI; answer Yes from both accounts, draft then publish selection, propose/join a car and check payment/withdrawal flows. Regular members must not see Administration, editable CACI or other private profiles. Admins can edit own/other CACI; untouched editor input refreshes from shared data, deliberate edits remain and conflicting writes require explicit reload. This is local acceptance, not hosted/real organizer approval.

## 2026-10-04 permission diagnosis

Before code changes, local source and all 12 applied migrations matched `83562eb`. Auth identities matched both accounts. `organisateur` was president and `membre` was admin. An audit event at **2026-10-04 09:26:35 Europe/Paris** records the president promoting `membre` from member to admin. The earlier manual provisioning created it as a member; import retries preserve existing roles, so they would not undo a subsequent promotion. Both observed capabilities were authorized for that actual database role.

After deterministic setup restored `member`, real authenticated API calls to `set_member_caci` for self/organizer returned `42501`; private-profile SELECT returned only self, and selecting the organizer returned no rows. No redundant JSX/RLS changes were needed. Browser regressions also cover admin→member switching without retaining directory/CACI UI. Existing delayed-identity Auth tests remain in place.

A separate stale CACI editor defect was present: state initialized once and writes were unconditional. The editor now updates untouched fields, retains unsaved edits, and uses a row-locked expected-value RPC to reject concurrent changes. The existing admin-only audited write remains available for explicit operator/API operations; browser editors use the guarded path. The named follow-up review file was not present in the available workspace/Downloads; the explicit stale-editor requirements in the acceptance request were implemented and tested.

The pre-reset local acceptance database was preserved privately in ignored `.private/local-acceptance-before-2026-10-04.sql`. Do not publish database dumps or use real accounts for screenshots.
