import { pathToFileURL } from 'node:url'
import { createOperatorClient } from './operator-client.mjs'

// Public project identity, deliberately pinned in source; no override switch.
export const STAGING_REF = 'btpojwwwsxrepsehmxbm'
export const STAGING_URL = `https://${STAGING_REF}.supabase.co`
export const SEED = 'ifosse-staging-v1'
export const seedEmail = index => `plongeur-${String(index).padStart(2, '0')}@ifosse-seed.invalid`
class SeedError extends Error {}
const usage = 'Usage: npm run staging:seed [-- --apply]\nDefault: staging preflight and plan only; no writes. Production is unsupported.'
export function parseSeedArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true }
  if (args.length === 0) return { apply: false }
  if (args.length === 1 && args[0] === '--apply') return { apply: true }
  throw new SeedError(usage)
}
export function readStagingConfig(env = process.env) {
  const missing = ['SUPABASE_URL', 'SUPABASE_PROJECT_ENV', 'SUPABASE_SERVICE_ROLE_KEY'].filter(name => !env[name])
  if (missing.length) throw new SeedError(`Missing operator environment variables: ${missing.join(', ')}. Export them in this terminal; .env.local is not loaded.`)
  // A missing production variable is never evidence of a safe target.
  if (env.SUPABASE_URL !== STAGING_URL || env.SUPABASE_PROJECT_ENV !== 'preview') {
    throw new SeedError('Seed requires the pinned ifosse-staging URL and SUPABASE_PROJECT_ENV=preview.')
  }
  let claims
  try { claims = JSON.parse(Buffer.from(env.SUPABASE_SERVICE_ROLE_KEY.split('.')[1], 'base64url').toString()) } catch { /* Fail closed. */ }
  if (claims?.role !== 'service_role' || claims?.ref !== STAGING_REF) {
    throw new SeedError('Seed requires the staging project legacy service_role JWT; opaque secret keys are unsupported.')
  }
  return { project: 'ifosse-staging', url: STAGING_URL, ref: STAGING_REF, environment: 'preview' }
}
function checked(result, stage = 'Preflight') {
  if (result.error || !result.data) {
    const hints = {
      PGRST202: 'Seed RPC missing. Apply migration 20261005010000_staging_seed.sql to staging first.',
      '42501': 'Seed authorization refused. Verify the staging legacy service_role JWT and project ref.',
      '23505': 'Synthetic identity collision. Inspect ownership; existing accounts were not adopted.',
      '22023': 'Seed ownership/state is inconsistent. Inspect registered fixtures; do not reset tester data.',
    }
    throw new SeedError(`${stage} failed. ${hints[result.error?.code] ?? 'Check migrations, ownership and operator configuration; no provider details are logged.'}`)
  }
  return result.data
}
export function seedFailureMessage(error) {
  return error instanceof SeedError ? error.message : 'Staging seed failed. Check connectivity and operator configuration. No secrets or provider responses are printed.'
}
export async function seedStaging(client, env, { apply = false } = {}) {
  const target = readStagingConfig(env) // Before the first request, including dry-run.
  const status = checked(await client.rpc('staging_seed_status'))
  if (status.seed !== SEED || status.project_ref !== STAGING_REF || !Array.isArray(status.auth_ids) || status.auth_ids.length !== 30) throw new SeedError('Unexpected staging seed preflight response.')
  const plan = { target, action: status.initialized ? 'retain existing dataset without writes' : 'initialize synthetic dataset', seed: SEED, anchor: status.anchor ?? 'Paris date at first apply', members: 30, sessions: 7, participations: 210, selectionPublications: 7, activeCars: 3, passengers: 7, palanqueeAssignments: 20, completedSessions: 3, retained: status.initialized, dryRun: !apply }
  if (!apply || status.initialized) return { ...plan, writes: 0 }
  const ids = [...status.auth_ids]
  for (let i = 0; i < ids.length; i += 1) {
    if (!ids[i]) {
      const user = checked(await client.auth.admin.createUser({ email: seedEmail(i + 1), email_confirm: true, app_metadata: { ifosse_staging_seed: SEED } }), 'Auth provisioning')
      if (!user.user?.id) throw new SeedError('Synthetic Auth provisioning failed; rerun to resume owned identities.')
      ids[i] = user.user.id
    }
  }
  // One PostgreSQL transaction: business failures cannot leave partial sessions.
  const result = checked(await client.rpc('apply_staging_seed', { p_auth_ids: ids }), 'Database apply')
  return { ...plan, ...result, dryRun: false }
}
async function main() {
  const options = parseSeedArgs(process.argv.slice(2))
  if (options.help) return console.log(usage)
  readStagingConfig()
  const result = await seedStaging(createOperatorClient(), process.env, options)
  console.log(JSON.stringify(result, null, 2))
  console.log(result.dryRun ? 'Dry run: no writes and no emails.' : 'Synthetic staging data ready. Existing tester data preserved. No emails sent.')
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(seedFailureMessage(error)); process.exitCode = 1 })
