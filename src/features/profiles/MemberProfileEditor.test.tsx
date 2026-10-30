import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { MemberProfileEditor } from './MemberProfileEditor'

afterEach(cleanup)
const member = { id: 'other', first_name: 'Alice', last_name: 'Test', phone: null, current_level: 'N1', preparing_level: 'N2', updated_at: '2026-10-30T10:00:00Z' } as Member
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement

it('saves the selected member and free-text levels, retaining input on a server refusal', async () => {
  const rpc = vi.fn(async () => ({ error: { code: '42501' } }))
  const refresh = vi.fn(async () => {})
  render(<MemberProfileEditor client={{ rpc } as unknown as SupabaseClient<Database>} member={member} onRefresh={refresh} />)
  fireEvent.change(field('Niveau actuel'), { target: { value: 'Qualification libre' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }))
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(rpc).toHaveBeenCalledWith('update_member_profile_if_current', expect.objectContaining({ p_member_id: 'other', p_expected_updated_at: member.updated_at, p_current_level: 'Qualification libre' }))
  expect(field('Niveau actuel').value).toBe('Qualification libre')
  expect(refresh).not.toHaveBeenCalled()
})

it('preserves a dirty editor across refresh and requires explicit reload after a concurrent change', () => {
  const rpc = vi.fn()
  const client = { rpc } as unknown as SupabaseClient<Database>
  const view = render(<MemberProfileEditor client={client} member={member} onRefresh={async () => {}} />)
  fireEvent.change(field('Niveau actuel'), { target: { value: 'N2' } })
  view.rerender(<MemberProfileEditor client={client} member={{ ...member, current_level: 'N3', updated_at: '2026-10-30T11:00:00Z' }} onRefresh={async () => {}} />)
  expect(field('Niveau actuel').value).toBe('N2')
  expect((screen.getByRole('button', { name: 'Enregistrer le profil' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Recharger le profil enregistré' }))
  expect(field('Niveau actuel').value).toBe('N3')
  expect((screen.getByRole('button', { name: 'Enregistrer le profil' }) as HTMLButtonElement).disabled).toBe(false)
  expect(rpc).not.toHaveBeenCalled()
})

it('handles a server conflict and blank names without losing the entered phone', async () => {
  const rpc = vi.fn(async () => ({ error: { code: '40001' } }))
  const refresh = vi.fn(async () => {})
  render(<MemberProfileEditor client={{ rpc } as unknown as SupabaseClient<Database>} member={member} onRefresh={refresh} />)
  fireEvent.change(field('Prénom'), { target: { value: '  ' } })
  fireEvent.change(field('Téléphone'), { target: { value: '0600000000' } })
  const form = screen.getByRole('form')
  fireEvent.submit(form)
  expect(rpc).not.toHaveBeenCalled()
  expect(field('Prénom').getAttribute('aria-invalid')).toBe('true')
  fireEvent.change(field('Prénom'), { target: { value: 'Alice' } })
  fireEvent.submit(form)
  await waitFor(() => expect(refresh).toHaveBeenCalled())
  expect(field('Téléphone').value).toBe('0600000000')
  expect((screen.getByRole('button', { name: 'Enregistrer le profil' }) as HTMLButtonElement).disabled).toBe(true)
})
