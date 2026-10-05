// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { seedFailureMessage, parseSeedArgs, readStagingConfig, seedStaging, seedEmail, STAGING_REF, STAGING_URL, SEED } from './staging-seed.mjs'
const token = claims => `fixture.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.fixture`
const env = { SUPABASE_URL: STAGING_URL, SUPABASE_PROJECT_ENV: 'preview', SUPABASE_SERVICE_ROLE_KEY: token({ role: 'service_role', ref: STAGING_REF }) }
const preflight = { seed: SEED, project_ref: STAGING_REF, initialized: false, auth_ids: Array(30).fill(null) }
function client() {
  return {
    rpc: vi.fn(async name => ({ data: name === 'staging_seed_status' ? preflight : { initialized: true }, error: null })),
    auth: { admin: { createUser: vi.fn(async ({ email }) => ({ data: { user: { id: email } }, error: null })) } },
  }
}
it('requires all positive staging signals and refuses production even when mislabeled', () => {
  expect(readStagingConfig(env).ref).toBe(STAGING_REF)
  for (const patch of [
    { SUPABASE_URL: 'https://production.supabase.co' }, { SUPABASE_URL: undefined },
    { SUPABASE_URL: `${STAGING_URL}/extra` }, { SUPABASE_PROJECT_ENV: 'production' }, { SUPABASE_PROJECT_ENV: undefined },
    { SUPABASE_SERVICE_ROLE_KEY: token({ role: 'service_role', ref: 'production' }) },
    { SUPABASE_SERVICE_ROLE_KEY: token({ role: 'authenticated', ref: STAGING_REF }) },
    { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_unsupported' }, { SUPABASE_SERVICE_ROLE_KEY: undefined },
  ]) expect(() => readStagingConfig({ ...env, ...patch })).toThrow()
})
it('rejects unsafe CLI overrides and defaults to dry-run', () => {
  expect(parseSeedArgs([])).toEqual({ apply: false })
  expect(parseSeedArgs(['--apply'])).toEqual({ apply: true })
  for (const args of [['--reset'], ['--target-url', STAGING_URL], ['--apply', '--apply'], ['--force']]) expect(() => parseSeedArgs(args)).toThrow('Usage')
})
it('fails the target guard before any read or write', async () => {
  const c = client()
  await expect(seedStaging(c, { ...env, SUPABASE_URL: 'https://production.supabase.co' }, { apply: true })).rejects.toThrow()
  expect(c.rpc).not.toHaveBeenCalled()
  expect(c.auth.admin.createUser).not.toHaveBeenCalled()
})
it('dry-run reads only preflight and reports representative dependent records', async () => {
  const c = client()
  await expect(seedStaging(c, env)).resolves.toMatchObject({ dryRun: true, writes: 0, members: 30, sessions: 7, participations: 210, palanqueeAssignments: 20, passengers: 7 })
  expect(c.rpc).toHaveBeenCalledExactlyOnceWith('staging_seed_status')
  expect(c.auth.admin.createUser).not.toHaveBeenCalled()
})
it('creates only reserved marked identities, without passwords/invitations, then atomically applies', async () => {
  const c = client()
  await seedStaging(c, env, { apply: true })
  expect(c.auth.admin.createUser).toHaveBeenCalledTimes(30)
  expect(c.auth.admin.createUser.mock.calls.map(([args]) => args)).toEqual(Array.from({ length: 30 }, (_, i) => ({ email: seedEmail(i + 1), email_confirm: true, app_metadata: { ifosse_staging_seed: SEED } })))
  expect(c.rpc).toHaveBeenLastCalledWith('apply_staging_seed', { p_auth_ids: Array.from({ length: 30 }, (_, i) => seedEmail(i + 1)) })
})
it('rerun does not create identities, mutate records or reset tester edits', async () => {
  const c = client()
  c.rpc.mockResolvedValue({ data: { ...preflight, initialized: true, anchor: '2026-10-05' } })
  await expect(seedStaging(c, env, { apply: true })).resolves.toMatchObject({ retained: true, writes: 0, anchor: '2026-10-05' })
  expect(c.auth.admin.createUser).not.toHaveBeenCalled()
  expect(c.rpc).toHaveBeenCalledExactlyOnceWith('staging_seed_status')
})
it('resumes marked orphan identities after partial Auth failure', async () => {
  const c = client()
  c.rpc.mockResolvedValueOnce({ data: { ...preflight, auth_ids: Array.from({ length: 30 }, (_, i) => i < 29 ? `owned-${i}` : null) } })
  await seedStaging(c, env, { apply: true })
  expect(c.auth.admin.createUser).toHaveBeenCalledExactlyOnceWith({ email: seedEmail(30), email_confirm: true, app_metadata: { ifosse_staging_seed: SEED } })
})
it('ownership or schema failure aborts before Auth creation and does not log provider details', async () => {
  const c = client()
  c.rpc.mockResolvedValue({ error: { message: 'private credential' } })
  await expect(seedStaging(c, env, { apply: true })).rejects.toThrow('no provider details')
  expect(c.auth.admin.createUser).not.toHaveBeenCalled()
})

it('prints actionable safe configuration failures while suppressing arbitrary provider messages', () => {
  let failure
  try { readStagingConfig({}) } catch (error) { failure = error }
  expect(seedFailureMessage(failure)).toContain('Missing operator environment variables: SUPABASE_URL, SUPABASE_PROJECT_ENV, SUPABASE_SERVICE_ROLE_KEY')
  expect(seedFailureMessage(failure)).toContain('.env.local is not loaded')
  expect(seedFailureMessage(new Error('private-key-value'))).not.toContain('private-key-value')
})
it('identifies a missing migration without exposing the provider message', async () => {
  const c = client()
  c.rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'private-key-value' } })
  let failure
  try { await seedStaging(c, env) } catch (error) { failure = error }
  expect(seedFailureMessage(failure)).toContain('Apply migration 20261005010000_staging_seed.sql to staging first')
  expect(seedFailureMessage(failure)).not.toContain('private-key-value')
  expect(c.auth.admin.createUser).not.toHaveBeenCalled()
})
