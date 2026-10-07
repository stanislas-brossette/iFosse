import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from '../sessions/SessionEditor'
import { Palanquees } from './Palanquees'
afterEach(cleanup)
it('prioritizes own visible published group and refreshes after republication without reading a member draft', async () => {
  let group = 2
  const rpc = vi.fn(async (name: string) => ({ data: name === 'get_current_selection' ? [{ member_id: 'self', state: 'selected', current_level: 'N2', publication_id: 'selection' }] : name === 'get_current_palanquees' ? [
    { member_id: 'other', first_name: 'Anne', last_name: 'Fictive', current_level: 'N1', group_number: 1, publication_version: 1 },
    { member_id: 'self', first_name: 'Marc', last_name: 'Fictif', current_level: 'N2', group_number: group, publication_version: 1 },
  ] : [], error: null }))
  const from = vi.fn()
  render(<Palanquees client={{ rpc, from } as unknown as SupabaseClient<Database>} member={{ id: 'self', role: 'member' } as Member} session={{ id: 'session' } as Session} />)
  const own = await screen.findByRole('region', { name: 'Ma palanquée publiée' })
  expect(own.textContent).toContain('Palanquée 2')
  expect(own.textContent).toContain('Marc Fictif · vous')
  expect(own.textContent).not.toContain('Anne Fictive')
  expect(own.compareDocumentPosition(screen.getByRole('region', { name: 'Palanquée 1' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(from).not.toHaveBeenCalled()
  group = 3; fireEvent(window, new Event('focus'))
  await screen.findByRole('heading', { name: 'Palanquée 3' })
  expect(screen.queryByRole('heading', { name: 'Palanquée 2' })).toBeNull()
})
it.each([
  ['selected', false, 'Les palanquées ne sont pas encore publiées.'],
  ['selected', true, 'Vous n’êtes pas encore affecté à une palanquée publiée.'],
  ['withdrawn', true, 'Vous vous êtes désisté : aucune palanquée effective.'],
  ['waiting', true, 'Vous n’avez pas de place confirmée : aucune palanquée effective.'],
])('explains absent own group for %s, published=%s', async (state, published, text) => {
  const rpc = vi.fn(async (name: string) => ({ data: name === 'get_current_selection' ? [{ member_id: 'self', state, current_level: 'N2' }] : name === 'get_palanquee_state' && published ? [{ publication_version: 1 }] : [], error: null }))
  render(<Palanquees client={{ rpc } as unknown as SupabaseClient<Database>} member={{ id: 'self', role: 'member' } as Member} session={{ id: 'session' } as Session} />)
  await screen.findByText(text)
})
