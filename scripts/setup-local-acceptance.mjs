import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { provisionMembers } from './provision-members.mjs'

// Deliberately fixed identities, exclusively on the localhost development stack.
// Never log keys, sessions, links or provider response details.
try {
  const config = JSON.parse(execFileSync('./node_modules/.bin/supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
  const url = new URL(config.API_URL)
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error()
  const service = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  await provisionMembers(service, JSON.stringify([
    { email: 'organisateur@example.test', first_name: 'Organisateur', last_name: 'Fictif' },
    { email: 'membre@example.test', first_name: 'Membre', last_name: 'Fictif' },
  ]), { apply: true })
  const organizer = await service.from('members').select('id,role').eq('email', 'organisateur@example.test').single()
  const member = await service.from('members').select('id').eq('email', 'membre@example.test').single()
  if (organizer.error || member.error) throw Error()
  if (organizer.data.role !== 'president') {
    const result = await service.rpc('bootstrap_president', { p_member_id: organizer.data.id })
    if (result.error) throw Error() // Never recover/replace an unrelated president.
  }
  const link = await service.auth.admin.generateLink({ type: 'magiclink', email: 'organisateur@example.test' })
  if (link.error || !link.data.properties.hashed_token) throw Error()
  const president = createClient(config.API_URL, config.PUBLISHABLE_KEY || config.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const login = await president.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' })
  if (login.error) throw Error()
  const role = await president.rpc('set_member_role', { p_member_id: member.data.id, p_role: 'member' })
  if (role.error) throw Error()
  const check = await service.from('members').select('role').eq('id', member.data.id).single()
  if (check.error || check.data.role !== 'member') throw Error()
  await president.auth.signOut({ scope: 'local' })
  console.log('Local acceptance ready: organisateur@example.test = president; membre@example.test = member. No email sent. Existing sessions/profile data preserved.')
} catch {
  console.error('Local acceptance setup failed. Check the running localhost stack and existing presidency. No credentials or provider details are logged.')
  process.exitCode = 1
}
