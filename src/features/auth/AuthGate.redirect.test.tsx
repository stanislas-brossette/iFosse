import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { AppEnvironment } from '../../lib/config'
import { AuthGate } from './AuthGate'

const config = vi.hoisted(() => ({ environment: 'preview' as AppEnvironment }))
vi.mock('../../lib/publicConfig', () => ({ publicConfig: config }))
const dom = (globalThis as unknown as { jsdom: { reconfigure: (options: { url: string }) => void } }).jsdom
const originalUrl = window.location.href
afterEach(() => { cleanup(); dom.reconfigure({ url: originalUrl }); config.environment = 'preview' })

async function request(origin: string, environment: AppEnvironment) {
  dom.reconfigure({ url: origin }); config.environment = environment
  const signInWithOtp = vi.fn().mockResolvedValue({ error: null })
  const client = { auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithOtp,
  } } as unknown as SupabaseClient<Database>
  render(<AuthGate client={client}>{() => null}</AuthGate>)
  await screen.findByRole('heading', { name: 'Connexion à iFosse' })
  fireEvent.change(screen.getByLabelText('Adresse email'), { target: { value: 'Camille@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Recevoir un lien de connexion' }))
  return signInWithOtp
}

describe('login request redirects', () => {
  it.each([
    ['https://ifosse-staging.netlify.app', 'preview'],
    ['https://deploy-preview-54--ifosse-staging.netlify.app', 'preview'],
    ['https://master--ifosse-staging.netlify.app', 'preview'],
    ['http://localhost:5173', 'local'],
    ['https://ifosse.netlify.app', 'production'],
  ] as const)('requests a same-origin callback from %s', async (origin, environment) => {
    const signInWithOtp = await request(origin, environment)
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledExactlyOnceWith({
      email: 'camille@example.test', options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm` },
    }))
    expect(await screen.findByRole('status')).toBeTruthy()
  })
  it.each([
    ['https://unexpected.netlify.app', 'preview'],
    ['https://deploy-preview-54--ifosse-staging.netlify.app', 'production'],
  ] as const)('refuses the request before contacting Auth from %s in %s', async (origin, environment) => {
    const signInWithOtp = await request(origin, environment)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Cette adresse n’est pas autorisée pour la connexion à iFosse.')
    expect(signInWithOtp).not.toHaveBeenCalled()
  })
})
