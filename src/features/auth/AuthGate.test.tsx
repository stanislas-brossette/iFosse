import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import { AuthGate } from './AuthGate'
import type { Member } from './AuthGate'

afterEach(cleanup)
const session = (id: string) => ({ user: { id } }) as Session
const member = (id: string) => ({ id, auth_user_id: id, first_name: id, last_name: 'Test', role: id === 'A' ? 'admin' : 'member' }) as Member
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
function setup(initial = Promise.resolve({ data: { session: session('A') }, error: null })) {
  let notify!: (event: AuthChangeEvent, value: Session | null) => void
  const requests: ReturnType<typeof deferred<{ data: Member | null; error: null }>>[] = []
  const query = { select: () => query, eq: () => query, maybeSingle: () => { const request = deferred<{ data: Member | null; error: null }>(); requests.push(request); return request.promise } }
  const client = { auth: { getSession: () => initial, onAuthStateChange: (callback: typeof notify) => { notify = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } } }, from: () => query } as unknown as SupabaseClient<Database>
  render(<AuthGate client={client}>{value => <><h1>Compte {value.first_name}</h1>{value.role !== 'member' && <button>Administration privée</button>}<label>Champ non enregistré<input defaultValue={value.first_name} /></label></>}</AuthGate>)
  return { requests, event: async (event: AuthChangeEvent, value: Session | null) => { await act(async () => notify(event, value)) }, resolve: async (index: number, value: Member | null) => { await act(async () => requests[index].resolve({ data: value, error: null })) } }
}
describe('authenticated identity and pending profile requests', () => {
  it('keeps unsaved state during same-account refresh and clears access when the profile disappears', async () => {
    const app = setup()
    await waitFor(() => expect(app.requests).toHaveLength(1)); await app.resolve(0, member('A'))
    fireEvent.change(screen.getByLabelText('Champ non enregistré'), { target: { value: 'Travail en cours' } })
    await app.event('TOKEN_REFRESHED', session('A'))
    expect((screen.getByLabelText('Champ non enregistré') as HTMLInputElement).value).toBe('Travail en cours')
    await app.resolve(1, member('A'))
    expect((screen.getByLabelText('Champ non enregistré') as HTMLInputElement).value).toBe('Travail en cours')
    await app.event('TOKEN_REFRESHED', session('A')); await app.resolve(2, null)
    expect(screen.queryByLabelText('Champ non enregistré')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Profil indisponible' })).toBeTruthy()
  })
  it('removes cached app access when a refresh returns a suspended profile', async () => {
    const app = setup()
    await waitFor(() => expect(app.requests).toHaveLength(1)); await app.resolve(0, member('A'))
    fireEvent(window, new Event('focus'))
    await app.resolve(1, { ...member('A'), disabled_at: '2026-10-06T12:00:00Z' })
    expect(screen.queryByRole('button', { name: 'Administration privée' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Profil indisponible' })).toBeTruthy()
  })
  it('ignores an old account response after a switch, including a focus refresh', async () => {
    const app = setup()
    await waitFor(() => expect(app.requests).toHaveLength(1)); await app.resolve(0, member('A'))
    expect(screen.getByRole('button', { name: 'Administration privée' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Champ non enregistré'), { target: { value: 'Privé A' } })
    fireEvent(window, new Event('focus'))
    await app.event('SIGNED_IN', session('B'))
    expect(screen.queryByRole('button', { name: 'Administration privée' })).toBeNull()
    expect(screen.queryByLabelText('Champ non enregistré')).toBeNull()
    await app.resolve(2, member('B')); await app.resolve(1, member('A'))
    expect(screen.getByRole('heading', { name: 'Compte B' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Administration privée' })).toBeNull()
    expect((screen.getByLabelText('Champ non enregistré') as HTMLInputElement).value).toBe('B')
    await app.event('SIGNED_OUT', null)
    expect(screen.queryByLabelText('Champ non enregistré')).toBeNull()
  })
  it('does not resurrect a signed-out account from a late initial session read', async () => {
    const initial = deferred<{ data: { session: Session }; error: null }>()
    const app = setup(initial.promise)
    await app.event('SIGNED_IN', session('A')); await app.resolve(0, member('A'))
    await app.event('TOKEN_REFRESHED', session('A')); await app.event('SIGNED_OUT', null)
    await app.resolve(1, member('A'))
    await act(async () => initial.resolve({ data: { session: session('A') }, error: null }))
    expect(screen.getByRole('heading', { name: 'Connexion à iFosse' })).toBeTruthy()
    expect(screen.queryByLabelText('Champ non enregistré')).toBeNull()
  })
})
