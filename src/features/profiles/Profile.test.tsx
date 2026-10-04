import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { Profile } from './Profile'
afterEach(cleanup)
const client = {} as SupabaseClient<Database>
const initial = { id: 'member', auth_user_id: 'account', first_name: 'Membre', last_name: 'Test', role: 'member', email: 'fictif@example.test', phone: '', current_level: 'N2', preparing_level: '', caci_expiry_date: null, has_usual_car: false, usual_passenger_seats: 0, usual_meeting_point: '' } as Member
const saved = { ...initial, has_usual_car: true, usual_passenger_seats: 2, usual_meeting_point: 'Parking' }
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
describe('profile defaults changed by an explicit session opt-in', () => {
  it('shows committed defaults without replacing unrelated unsaved profile input', () => {
    const view = render(<Profile client={client} member={initial} refresh={async () => {}} />)
    fireEvent.change(field('Téléphone'), { target: { value: '0699999999' } })
    view.rerender(<Profile client={client} member={saved} refresh={async () => {}} />)
    expect(field('Téléphone').value).toBe('0699999999')
    expect(field('J’ai habituellement une voiture disponible').checked).toBe(true)
    expect(field('Places passagers habituelles').value).toBe('2')
    expect(field('Point de rendez-vous habituel').value).toBe('Parking')
  })
  it('keeps unsaved car-default edits when the same account is refreshed', () => {
    const view = render(<Profile client={client} member={saved} refresh={async () => {}} />)
    fireEvent.change(field('Places passagers habituelles'), { target: { value: '5' } })
    fireEvent.change(field('Point de rendez-vous habituel'), { target: { value: 'Brouillon privé' } })
    view.rerender(<Profile client={client} member={{ ...saved, usual_passenger_seats: 4, usual_meeting_point: 'Autre appareil' }} refresh={async () => {}} />)
    expect(field('Places passagers habituelles').value).toBe('5')
    expect(field('Point de rendez-vous habituel').value).toBe('Brouillon privé')
  })
})
