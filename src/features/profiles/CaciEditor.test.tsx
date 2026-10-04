import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { CaciEditor } from './Profile'
afterEach(cleanup)
const member = { id: 'member', caci_expiry_date: '2027-12-31' } as Member
const input = () => screen.getByLabelText('Fin de validité CACI') as HTMLInputElement
it('refreshes an untouched editor but preserves deliberate unsaved edits', () => {
  const client = {} as SupabaseClient<Database>
  const view = render(<CaciEditor client={client} member={member} onSaved={async () => {}} />)
  view.rerender(<CaciEditor client={client} member={{ ...member, caci_expiry_date: '2028-12-31' }} onSaved={async () => {}} />)
  expect(input().value).toBe('2028-12-31')
  fireEvent.change(input(), { target: { value: '2029-06-01' } })
  view.rerender(<CaciEditor client={client} member={{ ...member, caci_expiry_date: '2030-12-31' }} onSaved={async () => {}} />)
  expect(input().value).toBe('2029-06-01')
  expect((screen.getByRole('button', { name: 'Enregistrer le CACI' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Recharger la date enregistrée' }))
  expect(input().value).toBe('2030-12-31')
})
it('sends the original value to the locked compare-and-write RPC and retains input on conflict', async () => {
  const rpc = vi.fn().mockResolvedValue({ error: { code: '40001' } })
  const refresh = vi.fn().mockResolvedValue(undefined)
  render(<CaciEditor client={{ rpc } as unknown as SupabaseClient<Database>} member={member} onSaved={refresh} />)
  fireEvent.change(input(), { target: { value: '2028-12-31' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le CACI' }))
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  expect(rpc).toHaveBeenCalledWith('set_member_caci_if_current', { p_member_id: 'member', p_expiry_date: '2028-12-31', p_expected_expiry_date: '2027-12-31' })
  expect(input().value).toBe('2028-12-31')
  expect(screen.getByRole('status').textContent).toContain('modifié ailleurs')
})
