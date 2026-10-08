import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
import {vi} from 'vitest'
it('formats CACI and suggests levels without constraining free labels or changing date storage',async()=>{
 const rpc=vi.fn(async()=>({error:null}))
 render(<Profile client={{rpc} as unknown as SupabaseClient<Database>} member={{...initial,caci_expiry_date:'2026-10-15'}} refresh={async()=>{}} />)
 expect(screen.getByText(/valable jusqu’au 15 octobre 2026/)).toBeTruthy()
 expect(field('Niveau actuel').getAttribute('list')).toBe('profile-levels');expect(document.querySelector('#profile-levels option[value=N2]')).toBeTruthy()
 fireEvent.change(field('Niveau actuel'),{target:{value:'Qualification libre fictive'}})
 fireEvent.click(screen.getByRole('button',{name:'Enregistrer mon profil'}))
 await waitFor(()=>expect(rpc).toHaveBeenCalledWith('update_own_profile',expect.objectContaining({p_current_level:'Qualification libre fictive'})))
 expect(field('Niveau actuel').value).toBe('Qualification libre fictive')
})
it('attaches a known name validation error and preserves all other input',async()=>{
 const rpc=vi.fn();render(<Profile client={{rpc} as unknown as SupabaseClient<Database>} member={initial} refresh={async()=>{}} />)
 fireEvent.change(field('Prénom'),{target:{value:'   '}});fireEvent.change(field('Téléphone'),{target:{value:'0600000000'}})
 fireEvent.submit(screen.getByRole('button',{name:'Enregistrer mon profil'}).closest('form')!)
 const alert=screen.getByRole('alert');expect(field('Prénom').getAttribute('aria-describedby')).toBe(alert.id);expect(field('Prénom').getAttribute('aria-invalid')).toBe('true')
 expect(field('Téléphone').value).toBe('0600000000');expect(rpc).not.toHaveBeenCalled()
})
