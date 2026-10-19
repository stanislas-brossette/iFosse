import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import { NotificationCenter } from './NotificationCenter'
import { parseInbox, noticeRoute } from './model'
const {navigate}=vi.hoisted(()=>({navigate:vi.fn()}))
vi.mock('../../lib/navigation',()=>({navigate}))
const notice={id:'aa000000-0000-4000-8000-000000000001',kind:'selection_published',session_id:'ab000000-0000-4000-8000-000000000001',title:'Sélection publiée',message:'Fosse fictive — confirmé.',created_at:'2026-10-18T12:00:00Z',read_at:null}
const inbox={enabled:true,unread_count:1,items:[notice],has_more:false}
beforeEach(()=>{
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal=function(){this.open=true}
  HTMLDialogElement.prototype.close=function(){this.open=false}
})
afterEach(cleanup)
function setup(data:unknown=inbox){
  const rpc=vi.fn().mockResolvedValue({data,error:null})
  const client={rpc} as unknown as SupabaseClient<Database>
  const view=render(<NotificationCenter client={client}/>);return {rpc,client,...view}
}
it('is absent when disabled or schema is not deployed, without interfering with the page',async()=>{
  const app=setup({...inbox,enabled:false})
  await waitFor(()=>expect(app.rpc).toHaveBeenCalledOnce())
  expect(screen.queryByRole('button')).toBeNull()
  app.unmount()
  const rpc=vi.fn().mockResolvedValue({data:null,error:{code:'PGRST202'}})
  render(<NotificationCenter client={{rpc} as unknown as SupabaseClient<Database>}/> )
  await act(async()=>{})
  fireEvent(window,new Event('focus'));await act(async()=>{})
  expect(rpc).toHaveBeenCalledOnce();expect(screen.queryByRole('button')).toBeNull()
})
it('opens own notices, marks read by ID and navigates only to an internal session route',async()=>{
  const {rpc}=setup()
  fireEvent.click(await screen.findByRole('button',{name:'Notifications : 1 non lues'}))
  expect(screen.getByRole('dialog',{name:'Mes notifications'})).toBeTruthy()
  await act(async()=>{})
  let acknowledge!:(result:{data:null,error:null})=>void
  const pendingRead=new Promise<{data:null,error:null}>(resolve=>{acknowledge=resolve})
  rpc.mockReturnValueOnce(pendingRead)
  fireEvent.click(screen.getByRole('button',{name:'Voir la séance'}))
  expect(rpc).toHaveBeenCalledWith('mark_app_notifications_read',{p_ids:[notice.id]})
  expect(navigate).toHaveBeenCalledWith({area:'sessions',tab:'overview',view:'all',sessionId:notice.session_id})
  expect(screen.queryByRole('dialog')).toBeNull()
  // Navigation/closure is immediate; unread changes only after server acknowledgement.
  expect(screen.getByRole('button',{name:'Notifications : 1 non lues'})).toBeTruthy()
  await act(async()=>{acknowledge({data:null,error:null})})
  expect(screen.getByRole('button',{name:'Notifications'})).toBeTruthy()
})
it('preserves unread on failure, supports retry and returns focus on Escape',async()=>{
  const {rpc}=setup()
  const bell=await screen.findByRole('button',{name:'Notifications : 1 non lues'})
  fireEvent.click(bell);await act(async()=>{})
  rpc.mockResolvedValueOnce({data:null,error:{code:'NETWORK'}})
  fireEvent.click(screen.getByRole('button',{name:'Marquer comme lue'}))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByText('Non lue')).toBeTruthy()
  fireEvent(screen.getByRole('dialog'),new Event('cancel',{cancelable:true}))
  expect(document.activeElement).toBe(bell)
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('loads a bounded next page using the last row cursor and removes duplicates',async()=>{
  const {rpc}=setup({...inbox,has_more:true})
  fireEvent.click(await screen.findByRole('button',{name:'Notifications : 1 non lues'}));await act(async()=>{})
  rpc.mockResolvedValueOnce({data:{...inbox,items:[notice,{...notice,id:'aa000000-0000-4000-8000-000000000002',title:'Autre notification'}]},error:null})
  fireEvent.click(screen.getByRole('button',{name:'Voir plus'}))
  expect(await screen.findByText('Autre notification')).toBeTruthy()
  expect(rpc).toHaveBeenLastCalledWith('get_my_notifications',{p_before_time:notice.created_at,p_before_id:notice.id})
  expect(screen.getAllByText('Sélection publiée')).toHaveLength(1)
})
it('discards an in-flight private response after unmount/account change',async()=>{
  let resolve!:(value:unknown)=>void
  const rpc=vi.fn().mockReturnValue(new Promise(done=>{resolve=done}))
  const app=render(<NotificationCenter client={{rpc} as unknown as SupabaseClient<Database>}/> )
  app.unmount()
  await act(async()=>resolve({data:inbox,error:null}))
  expect(screen.queryByText('Notifications')).toBeNull()
})
it('rejects malformed payloads and arbitrary redirect targets',()=>{
  expect(()=>parseInbox({...inbox,items:[{...notice,session_id:'https://evil.test'}]})).toThrow()
  expect(()=>parseInbox({...inbox,unread_count:-1})).toThrow()
  expect(()=>parseInbox({...inbox,items:[{...notice,created_at:'invalid'}]})).toThrow()
  expect(noticeRoute({...notice,kind:'caci_updated',session_id:null})).toEqual({area:'profile',tab:'overview',view:'upcoming'})
  expect(noticeRoute({...notice,kind:'carpool_updated'}).tab).toBe('transport')
})
