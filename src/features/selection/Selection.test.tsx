import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from '../sessions/SessionEditor'
import { Selection } from './Selection'
afterEach(() => { cleanup(); sessionStorage.clear() })
function setup() {
  const people = [{ member_id:'a', first_name:'Anne',last_name:'Zulu',rsvp:'yes',state:'pending',current_level:'N3',registered_at:'2026-10-01',publication_version:0 },{member_id:'b',first_name:'Bob',last_name:'Alpha',rsvp:'maybe',state:'pending',current_level:'N1',registered_at:'2026-10-02',publication_version:0}]
  const query = { select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,maybeSingle:async()=>({data:null}) }
  const client = {rpc:vi.fn(async()=>({data:people})),from:()=>query} as unknown as SupabaseClient<Database>
  return render(<Selection client={client} member={{id:'a',role:'admin'} as Member} session={{id:'session',date:'2026-10-10',capacity:20} as Session} manage={false} participants />)
}
it('shows a compact labelled control, applies default/name/reverse and restores after navigation', async () => {
  const first=setup(); await screen.findByText('Anne Zulu · N3')
  const list=screen.getByRole('list')
  expect(within(list).getAllByRole('listitem')[0].textContent).toContain('Anne Zulu')
  expect((screen.getByRole('combobox',{name:'Trier par'}) as HTMLSelectElement).value).toBe('response')
  expect(screen.queryByRole('option',{name:'Inscription'})).toBeNull()
  expect(screen.getAllByRole('option').map(option=>option.textContent)).toEqual(['Réponse','Nom','Niveau','Sélection'])
  expect(screen.queryByRole('searchbox')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Ordre croissant : passer à l’ordre décroissant'}))
  expect(within(list).getAllByRole('listitem')[0].textContent).toContain('Bob Alpha')
  fireEvent.change(screen.getByRole('combobox',{name:'Trier par'}),{target:{value:'name'}})
  expect(within(list).getAllByRole('listitem')[0].textContent).toContain('Bob Alpha')
  fireEvent.click(screen.getByRole('button',{name:'Ordre croissant : passer à l’ordre décroissant'}))
  expect(within(list).getAllByRole('listitem')[0].textContent).toContain('Anne Zulu')
  first.unmount(); setup(); await screen.findByText('Anne Zulu · N3')
  expect((screen.getByRole('combobox',{name:'Trier par'}) as HTMLSelectElement).value).toBe('name')
  expect(screen.getByRole('button',{name:'Ordre décroissant : passer à l’ordre croissant'})).toBeTruthy()
})
