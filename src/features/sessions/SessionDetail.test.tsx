import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from './SessionEditor'
import type { CardSummary } from './PublishedOccupancy'
import { SessionDetail } from './Sessions'
afterEach(cleanup)
it('refreshes effective personal state after republication/rejoin and preserves it on failure', async () => {
  let summary: CardSummary = { session_id: 'session', capacity: 20, confirmed_count: 1, publication_version: 0, my_rsvp: 'yes', my_selection_state: 'pending', my_transport_mode: 'needs', my_transport_provisional: false, my_payment_status: 'unpaid' }
  let fail = false
  const rpc = vi.fn(async (name: string) => ({ data: name === 'get_session_card_summaries' ? [summary] : [], error: fail ? { message: 'offline' } : null }))
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { rsvp: summary.my_rsvp }, error: null }) }
  const client = { rpc, from: () => query } as unknown as SupabaseClient<Database>
  render(<SessionDetail client={client} member={{ id: 'self', role: 'member', caci_expiry_date: '2099-12-31' } as Member} session={{ id: 'session', date: '2026-10-28', title: 'Fosse', start_time: '20:00', end_time: '21:00', capacity: 20, status: 'open', registration_open: true } as Session} onEdit={vi.fn()} onBack={vi.fn()} onChanged={vi.fn()} />)
  await screen.findByText('Votre réponse est enregistrée. La sélection n’est pas encore publiée.')
  expect(rpc).toHaveBeenCalledWith('get_session_card_summaries', { p_start_year: 2026 })
  summary = { ...summary, publication_version: 1, my_selection_state: 'selected' }
  fireEvent(window, new Event('focus'))
  await screen.findByText('Votre place est confirmée dans la sélection publiée.')
  summary = { ...summary, publication_version: 2, my_selection_state: 'withdrawn', my_rsvp: 'no' }
  fireEvent(window, new Event('focus'))
  await screen.findByText(/Vous vous êtes désisté/)
  summary = { ...summary, my_selection_state: 'waiting', my_rsvp: 'yes' }
  fireEvent(window, new Event('focus'))
  await screen.findByText(/Vous êtes en attente dans la sélection publiée/)
  fail = true; fireEvent(window, new Event('focus'))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('conservées'))
  expect(screen.getByText(/Vous êtes en attente dans la sélection publiée/)).toBeTruthy()
  expect(screen.queryByText(/Votre place est confirmée/)).toBeNull()
})
