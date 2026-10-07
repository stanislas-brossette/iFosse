import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from '../sessions/SessionEditor'
import { Carpooling } from './Carpooling'
afterEach(cleanup)
it('shows the reserved driver first, explicit missing details and no duplicate alternative; refresh handles withdrawal', async () => {
  let withdrawn = false
  const cars = [{ id: 'reserved', driver_member_id: 'driver', first_name: 'Zoé', last_name: 'Fictive', passenger_capacity: 3, occupied: 1, meeting_point: '', departure_time: null, note: '' }, { id: 'alternative', driver_member_id: 'other', first_name: 'Anne', last_name: 'Fictive', passenger_capacity: 2, occupied: 0, meeting_point: 'Gare', departure_time: '19:30', note: '' }]
  const rpc = vi.fn(async (name: string) => ({ data: name === 'get_car_offers' ? withdrawn ? cars.slice(1) : cars : name === 'get_session_transport' ? [{ member_id: 'self', first_name: 'Marc', last_name: 'Fictif', mode: withdrawn ? 'needs' : 'passenger', car_offer_id: withdrawn ? null : 'reserved' }] : [{ member_id: 'self', rsvp: 'yes', state: 'selected' }], error: null }))
  render(<Carpooling client={{ rpc } as unknown as SupabaseClient<Database>} member={{ id: 'self', role: 'member' } as Member} session={{ id: 'session', status: 'open' } as Session} />)
  const booked = await screen.findByRole('region', { name: 'Mon trajet réservé' })
  expect(within(booked).getByText('Zoé Fictive')).toBeTruthy()
  expect(booked.textContent).toContain('Rendez-vous à préciser · Heure de départ à préciser')
  expect(booked.textContent).toContain('Marc Fictif · vous')
  expect(booked.textContent).toContain('Trajet provisoire')
  expect(screen.queryByRole('button', { name: 'Rejoindre la voiture de Zoé Fictive' })).toBeNull()
  expect(booked.compareDocumentPosition(screen.getByRole('heading', { name: 'Autres voitures proposées' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  withdrawn = true; fireEvent(window, new Event('focus'))
  await screen.findByText(/Aucun trajet réservé/)
  expect(screen.queryByRole('region', { name: 'Mon trajet réservé' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Proposer une voiture' })).toBeTruthy()
})
