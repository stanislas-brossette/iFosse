import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './lib/database.types'
import type { PublicConfig } from './lib/config'
import App from './App'

const dependencies = vi.hoisted(() => ({
  config: null as PublicConfig | null,
  client: null as SupabaseClient<Database> | null,
}))
vi.mock('./lib/publicConfig', () => ({ get publicConfig() { return dependencies.config } }))
vi.mock('./lib/supabase', () => ({ get supabase() { return dependencies.client } }))
afterEach(cleanup)

it('renders the accessible French fallback shell when unconfigured', () => {
  dependencies.config = null
  dependencies.client = null
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Les séances du club APSAP')
  expect(screen.getByRole('status').textContent).toBe('Configuration locale à compléter.')
  expect(screen.queryByText('Connexion en cours…')).toBeNull()
})

it('uses the configured client for auth loading and then displays login', async () => {
  dependencies.config = { environment: 'preview', url: 'https://preview.example.test', key: 'sb_publishable_test_fixture' }
  let resolveSession!: (result: { data: { session: null }; error: null }) => void
  const initialSession = new Promise<{ data: { session: null }; error: null }>(resolve => { resolveSession = resolve })
  const getSession = vi.fn(() => initialSession)
  const unsubscribe = vi.fn()
  const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe } } }))
  dependencies.client = { auth: { getSession, onAuthStateChange } } as unknown as SupabaseClient<Database>
  render(<App />)
  expect(screen.getByRole('status').textContent).toBe('Connexion en cours…')
  expect(screen.queryByRole('heading', { name: 'Les séances du club APSAP' })).toBeNull()
  expect(getSession).toHaveBeenCalledOnce()
  expect(onAuthStateChange).toHaveBeenCalledOnce()
  await act(async () => resolveSession({ data: { session: null }, error: null }))
  expect(screen.getByRole('heading', { name: 'Connexion à iFosse' })).toBeTruthy()
  expect(screen.queryByText('Connexion en cours…')).toBeNull()
  cleanup()
  expect(unsubscribe).toHaveBeenCalledOnce()
})
