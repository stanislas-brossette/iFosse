# Stale-state conflicts and PostgREST 14

Four checked RPCs deliberately rejected stale client snapshots with SQLSTATE `40001`: CACI editing, selection publication, attendance batch and presidency transfer. PostgreSQL SQL tests caught that exception correctly, but PostgREST 14 may retry the whole transaction indefinitely instead of responding to HTTP clients. A 40-code syntax/ACL audit does not test this runtime behavior.

Migration `20261017120000_http_stale_conflicts.sql` changes only those four exception branches. They raise the documented PostgREST `PGRST` custom-response exception and return **HTTP 409** with the **existing JSON code `40001` and existing message**. Already deployed frontends therefore keep their current conflict/reload/reconfirmation behavior. No automatic replay, write, permission or business-rule change. Authorization, session/member locks, stale checks and transaction rollback remain intact. True PostgreSQL serialization failures are untouched.

Apply this migration, after its existing prerequisites, only to the explicitly selected hosted project as an operator. It is not deployed by Netlify. No migration was applied to a hosted or production project by this work. Existing SQL consumers catching these four intentional conflicts now receive SQLSTATE `PGRST` with JSON message/detail; HTTP consumers retain their existing payload. The pgTAP conflict assertions verify that full payload and all previous rollback/state assertions remain.

The browser regression waits for the 17-person preview before changing attendance, then requires a real HTTP 409/code 40001 response before reconfirmation. This covers the server boundary missed by direct SQL tests. No test timeout is increased and no conflict assertion is removed.

References: [Supabase diagnosis](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b), [PostgREST custom response format](https://docs.postgrest.org/en/stable/references/errors.html#add-http-headers-with-raise).
