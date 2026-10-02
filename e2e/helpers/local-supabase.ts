import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

type LocalStatus = {
  API_URL: string
  ANON_KEY: string
  PUBLISHABLE_KEY?: string
  SERVICE_ROLE_KEY: string
  MAILPIT_URL?: string
  INBUCKET_URL?: string
}

let localStatus: LocalStatus | undefined
function status(): LocalStatus {
  if (!localStatus) {
    try {
      localStatus = JSON.parse(execFileSync(resolve('node_modules/.bin/supabase'), ['status', '--output', 'json'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      })) as LocalStatus
    } catch {
      throw new Error('Local Supabase is unavailable. Start the development stack before browser tests.')
    }
    for (const endpoint of [localStatus.API_URL, localStatus.MAILPIT_URL || localStatus.INBUCKET_URL]) {
      if (!endpoint) throw new Error('A required local Supabase test endpoint is missing.')
      const url = new URL(endpoint)
      if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        throw new Error('Browser fixtures must run exclusively against the local Supabase stack.')
      }
    }
  }
  return localStatus
}

export const appOrigin = 'http://localhost:5173'
export const browserLaunchOptions = process.env.GOOGLE_CHROME_PATH ? { executablePath: process.env.GOOGLE_CHROME_PATH } : {}

export function anonymousClient() {
  const config = status()
  return createClient(config.API_URL, config.PUBLISHABLE_KEY || config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function serviceClient() {
  const config = status()
  return createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export type MemberFixture = {
  authUserId: string
  memberId: string
  email: string
  firstName: string
  messageIds: string[]
}

async function waitForLocalAuth() {
  const config = status()
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${config.API_URL}/auth/v1/health`, { headers: { apikey: config.ANON_KEY } })
      if (response.ok) return
    } catch { /* Local containers may still be restarting after reset. */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 500))
  }
  throw new Error('Local Auth did not become healthy after database reset.')
}

export async function createMemberFixture(): Promise<MemberFixture> {
  await waitForLocalAuth()
  const admin = serviceClient()
  const suffix = randomUUID()
  const email = `ifosse-e2e-${suffix}@example.test`
  const firstName = `Essai-${suffix.slice(0, 8)}`
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !data.user) throw new Error(`Test account creation failed (${error?.code || 'missing_user'}).`)
  try {
    const { data: memberId, error: provisionError } = await admin.rpc('provision_member', {
      p_auth_user_id: data.user.id, p_first_name: firstName, p_last_name: 'Fictif',
    })
    if (provisionError || typeof memberId !== 'string') throw new Error(`Test member provisioning failed (${provisionError?.code || 'missing_member'}).`)
    return { authUserId: data.user.id, memberId, email, firstName, messageIds: [] }
  } catch (error) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw error
  }
}

export async function removeMemberFixture(fixture: MemberFixture) {
  const admin = serviceClient()
  const { error: memberError } = await admin.from('members').delete().eq('id', fixture.memberId)
  const { error: authError } = await admin.auth.admin.deleteUser(fixture.authUserId)
  if (fixture.messageIds.length) {
    await fetch(`${status().MAILPIT_URL || status().INBUCKET_URL}/api/v1/messages`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: [...new Set(fixture.messageIds)] }),
    })
  }
  if (memberError || authError) throw new Error('A fictitious browser-test account could not be cleaned up.')
}

export async function requestMagicLink(page: Page, fixture: MemberFixture): Promise<string> {
  await page.goto('/')
  await page.getByLabel('Adresse email').fill(fixture.email)
  await page.getByRole('button', { name: 'Recevoir un lien de connexion' }).click()
  // A recipient unique to this test avoids touching or reading other mailboxes.
  const mailbox = status().MAILPIT_URL || status().INBUCKET_URL
  const search = `${mailbox}/api/v1/search?query=${encodeURIComponent(`to:${fixture.email}`)}`
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const response = await fetch(search)
    if (!response.ok) throw new Error('The local captured-email API is unavailable.')
    const result = await response.json() as { messages?: { ID: string }[] }
    const messageId = result.messages?.[0]?.ID
    if (messageId) {
      fixture.messageIds.push(messageId)
      const messageResponse = await fetch(`${mailbox}/api/v1/message/${encodeURIComponent(messageId)}`)
      if (!messageResponse.ok) throw new Error('The local test email could not be read.')
      const message = await messageResponse.json() as { HTML?: string }
      const href = message.HTML?.match(/href=["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;', '&')
      if (!href) throw new Error('The captured email contains no sign-in link.')
      const link = new URL(href)
      const fragment = new URLSearchParams(link.hash.slice(1))
      if (link.origin !== appOrigin || link.pathname !== '/auth/confirm' || !fragment.get('token_hash') || fragment.get('type') !== 'email') {
        throw new Error('The email template must target the local app confirmation page with a token hash.')
      }
      return href
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  throw new Error('The local magic-link email was not delivered within ten seconds.')
}

export async function openConfirmation(page: Page, link: string) {
  // Playwright errors include navigation URLs. Discard those details because a
  // magic-link hash is a bearer credential, even for these fictitious accounts.
  try { await page.goto(link) } catch { throw new Error('The local confirmation page could not be opened.') }
}

export function expireMagicLink(fixture: MemberFixture) {
  if (!/^[0-9a-f-]{36}$/i.test(fixture.authUserId)) throw new Error('Invalid test fixture identity.')
  // Backdate only this fictitious account's real Auth token timestamps. The
  // provider must reject it; the test does not mock expiry in the browser.
  const sql = `begin; update auth.users set confirmation_sent_at = now() - interval '1 day', recovery_sent_at = now() - interval '1 day' where id = '${fixture.authUserId}'; update auth.one_time_tokens set created_at = now() - interval '1 day' where user_id = '${fixture.authUserId}'; commit;`
  try {
    execFileSync('docker', ['exec', 'supabase_db_ifosse', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch { throw new Error('The local Auth token could not be expired for its regression test.') }
}
