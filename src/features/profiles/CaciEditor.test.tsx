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
  const view = render(<CaciEditor client={client} member={member} onRefresh={async () => {}} />)
  view.rerender(<CaciEditor client={client} member={{ ...member, caci_expiry_date: '2028-12-31' }} onRefresh={async () => {}} />)
  expect(input().value).toBe('2028-12-31')
  fireEvent.change(input(), { target: { value: '2029-06-01' } })
  view.rerender(<CaciEditor client={client} member={{ ...member, caci_expiry_date: '2030-12-31' }} onRefresh={async () => {}} />)
  expect(input().value).toBe('2029-06-01')
  expect((screen.getByRole('button', { name: 'Enregistrer le CACI' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Recharger la date enregistrée' }))
  expect(input().value).toBe('2030-12-31')
})
it('sends the original value to the locked compare-and-write RPC and retains input on conflict', async () => {
  const rpc = vi.fn().mockResolvedValue({ error: { code: '40001' } })
  const refresh = vi.fn().mockResolvedValue(undefined)
  const saved = vi.fn().mockResolvedValue(undefined)
  render(<CaciEditor client={{ rpc } as unknown as SupabaseClient<Database>} member={member} onRefresh={refresh} onSaved={saved} />)
  fireEvent.change(input(), { target: { value: '2028-12-31' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le CACI' }))
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  expect(rpc).toHaveBeenCalledWith('set_member_caci_if_current', { p_member_id: 'member', p_expiry_date: '2028-12-31', p_expected_expiry_date: '2027-12-31' })
  expect(saved).not.toHaveBeenCalled()
  expect(rpc).toHaveBeenCalledOnce()
  expect(input().value).toBe('2028-12-31')
  expect(input().getAttribute('aria-invalid')).toBe('true')
  expect(input().getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  expect(screen.getByRole('alert').textContent).toContain('modifié ailleurs')
})
it('shows a separate email receipt after a successful own CACI change', async () => {
  const rpc=vi.fn(async(name:string)=>name==='member_notification_status' ? {data:'disabled',error:null} : {error:null})
  render(<CaciEditor client={{rpc} as unknown as SupabaseClient<Database>} member={member} onRefresh={async()=>{}} />)
  fireEvent.change(input(),{target:{value:'2028-12-31'}})
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer le CACI'}))
  expect(await screen.findByText('Date CACI enregistrée.')).toBeTruthy()
  expect(await screen.findByText(/notifications désactivées/)).toBeTruthy()
  expect(rpc).toHaveBeenCalledWith('member_notification_status',{p_member_id:'member',p_event_type:'caci_date_changed'})
})
it.each(['2027-12-31',null])('does not claim a new email receipt for an unchanged date %s', async date => {
  const rpc=vi.fn().mockResolvedValue({error:null})
  render(<CaciEditor client={{rpc} as unknown as SupabaseClient<Database>} member={{...member,caci_expiry_date:date}} onRefresh={async()=>{}} />)
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer le CACI'}))
  await screen.findByText('Date CACI enregistrée.')
  expect(rpc).toHaveBeenCalledOnce()
  expect(screen.queryByText(/Email/)).toBeNull()
})
it('passes the actual change flag to the directory before it collapses the editor', async () => {
  const rpc=vi.fn().mockResolvedValue({error:null}), saved=vi.fn().mockResolvedValue(undefined)
  render(<CaciEditor client={{rpc} as unknown as SupabaseClient<Database>} member={member} onRefresh={async()=>{}} onSaved={saved} />)
  fireEvent.change(input(),{target:{value:'2028-12-31'}})
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer le CACI'}))
  await waitFor(()=>expect(saved).toHaveBeenCalledWith('2028-12-31',true))
  expect(rpc).toHaveBeenCalledOnce()
})
