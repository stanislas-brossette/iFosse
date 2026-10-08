import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { PresidencyTransfer } from './PresidencyTransfer'
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
afterEach(cleanup)
const person=(id:string,role:Member['role']='member')=>({id,auth_user_id:`auth-${id}`,first_name:id,last_name:'Fictif',email:`${id.toLowerCase()}@example.test`,role,disabled_at:null,updated_at:'2026-10-08T10:00:00.123456+00:00'}) as Member
const current=person('Président','president'),successor=person('Camille')
function setup(members=[current,successor,person('Admin','admin'),{...person('Inactif'),disabled_at:'2026-10-01'},{...person('Sans compte'),auth_user_id:null}]) {
 const rpc=vi.fn(async()=>({data:null,error:null}));const onReload=vi.fn(async()=>{}),onTransferred=vi.fn(async()=>{}),onAccessChanged=vi.fn(async()=>{})
 const props={client:{rpc} as unknown as SupabaseClient<Database>,current,members,onReload,onTransferred,onAccessChanged,onStart:(action:()=>void)=>action()}
 const view=render(<PresidencyTransfer {...props}/>);fireEvent.click(screen.getByText('Présidence du club · transfert exceptionnel'));fireEvent.click(screen.getByRole('button',{name:'Transférer la présidence'}))
 return {rpc,props,view,onTransferred,onReload,onAccessChanged}
}
function choose(){fireEvent.change(screen.getByLabelText('Successeur'),{target:{value:successor.id}})}
function acknowledge(){fireEvent.change(screen.getByLabelText('Recopier l’email du successeur'),{target:{value:successor.email.toUpperCase()}});fireEvent.click(screen.getByRole('checkbox'))}
const confirm=()=>screen.getByRole('button',{name:'Confirmer le transfert de présidence'}) as HTMLButtonElement
describe('deliberate presidency transfer',()=>{
 it('excludes self, suspended and unlinked accounts; cancel/Escape performs no request',()=>{
  const app=setup();expect(screen.getAllByRole('option')).toHaveLength(3);expect(screen.getByRole('dialog').textContent).toContain('Vous resterez administrateur')
  choose();expect(confirm().disabled).toBe(true);fireEvent(screen.getByRole('dialog'),new Event('cancel',{cancelable:true}));expect(screen.queryByRole('dialog')).toBeNull();expect(app.rpc).not.toHaveBeenCalled()
 })
 it('requires matching email AND acknowledgement, sends the exact snapshot once, and refreshes after success',async()=>{
  const app=setup();choose();fireEvent.click(confirm());expect(app.rpc).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Recopier l’email du successeur'),{target:{value:'autre@example.test'}});fireEvent.click(screen.getByRole('checkbox'));expect(confirm().disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Recopier l’email du successeur'),{target:{value:' CAMILLE@EXAMPLE.TEST '}});expect(confirm().disabled).toBe(false)
  const button=confirm();fireEvent.click(button);fireEvent.click(button);await waitFor(()=>expect(app.onTransferred).toHaveBeenCalledExactlyOnceWith(successor))
  expect(app.rpc).toHaveBeenCalledExactlyOnceWith('transfer_presidency_if_current',{p_member_id:successor.id,p_expected_updated_at:successor.updated_at})
 })
 it('blocks a changed snapshot and clears confirmation on explicit refresh or recipient change',()=>{
  const app=setup();choose();acknowledge();const changed={...successor,updated_at:'2026-10-08T11:00:00+00:00'}
  app.view.rerender(<PresidencyTransfer {...app.props} members={[current,changed,person('Admin','admin')]}/>);expect(confirm().disabled).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:'Actualiser le choix'}));expect((screen.getByLabelText('Recopier l’email du successeur') as HTMLInputElement).value).toBe('');expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);expect(app.rpc).not.toHaveBeenCalled()
  acknowledge();fireEvent.change(screen.getByLabelText('Successeur'),{target:{value:'Admin'}});expect((screen.getByLabelText('Recopier l’email du successeur') as HTMLInputElement).value).toBe('');expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);expect(confirm().disabled).toBe(true)
 })
 it('server conflict demands a new deliberate confirmation, never reports success',async()=>{
  const app=setup();app.rpc.mockResolvedValueOnce({data:null,error:{code:'40001',message:'SECRET'}} as never);choose();acknowledge();fireEvent.click(confirm())
  await waitFor(()=>expect(app.onReload).toHaveBeenCalledOnce());expect(confirm().disabled).toBe(true);expect(screen.getAllByRole('alert').map(x=>x.textContent).join()).toContain('Aucun transfert effectué');expect(screen.queryByText(/SECRET/)).toBeNull();expect(app.onTransferred).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Actualiser le choix'}));acknowledge();fireEvent.click(confirm());await waitFor(()=>expect(app.onTransferred).toHaveBeenCalledOnce())
 })
 it('rechecks caller access on authorization failure and bounds provider errors',async()=>{
  const app=setup();app.rpc.mockResolvedValueOnce({data:null,error:{code:'42501',message:'SECRET'}} as never);choose();acknowledge();fireEvent.click(confirm())
  await waitFor(()=>expect(app.onAccessChanged).toHaveBeenCalledOnce());expect(screen.getByRole('alert').textContent).toContain('Vos droits');expect(screen.queryByText(/SECRET/)).toBeNull();expect(app.onTransferred).not.toHaveBeenCalled()
 })
 it('an ambiguous network failure requires access refresh and reconfirmation',async()=>{
  const app=setup();app.rpc.mockRejectedValueOnce(new Error('SECRET'));choose();acknowledge();fireEvent.click(confirm())
  await waitFor(()=>expect(app.onAccessChanged).toHaveBeenCalledOnce());expect(confirm().disabled).toBe(true);expect(screen.getAllByRole('alert').map(x=>x.textContent).join()).toContain('Résultat du transfert indisponible');expect(screen.queryByText(/SECRET/)).toBeNull()
 })
})
