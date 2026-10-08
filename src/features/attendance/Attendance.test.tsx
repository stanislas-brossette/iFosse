import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '../../lib/database.types'
import type {Member} from '../auth/AuthGate'
import type {Session} from '../sessions/SessionEditor'
import {Attendance} from './Attendance'
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}
afterEach(cleanup)
const id='53000000-0000-4000-8000-000000000001'
const person={id,first_name:'Camille',last_name:'Fictif',disabled_at:null}
function setup(role:Member['role']='admin',ended=true){
 const query={select:()=>query,order:async()=>({data:[person],error:null})}
 const rpc=vi.fn(async(name:string)=>{
  if(name==='get_session_attendance')return {data:[{member_id:id,first_name:'Camille',last_name:'Fictif',attendance_status:'unknown'}],error:null}
  if(name==='get_current_selection')return {data:[{member_id:id,state:'selected'}],error:null}
  if(name==='get_bilan_state')return {data:[{session_ended:ended,unknown_selected_count:1,dived_count:0}],error:null}
  return {data:null,error:{code:'PGRST202',message:'SECRET'}}
 })
 const client={rpc,from:()=>query} as unknown as SupabaseClient<Database>
 render(<Attendance client={client} member={{role} as Member} session={{id,status:'open'} as Session} onChanged={async()=>{}} />)
 return rpc
}
it('explains a missing batch RPC without opening a confirmation or making a write',async()=>{
 const rpc=setup();const button=await screen.findByRole('button',{name:'Marquer les confirmés comme ayant plongé'});fireEvent.click(button)
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('mise à jour du serveur'))
 expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByText(/SECRET/)).toBeNull();expect(rpc.mock.calls.some(([name])=>name==='mark_confirmed_attendance')).toBe(false)
})
it('never offers a batch to members or before session end',async()=>{
 setup('member');await screen.findByText('Le bilan sera visible après validation par un administrateur.')
 expect(screen.queryByRole('button',{name:'Marquer les confirmés comme ayant plongé'})).toBeNull();cleanup()
 setup('admin',false);await screen.findByText(/après l’heure de fin/)
 expect(screen.queryByRole('button',{name:'Marquer les confirmés comme ayant plongé'})).toBeNull()
})
