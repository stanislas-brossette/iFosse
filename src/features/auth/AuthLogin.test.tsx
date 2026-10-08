import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { afterEach,expect,it,vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import { AuthGate } from './AuthGate'
vi.mock('./redirect',()=>({loginRedirectUrl:()=> 'http://localhost:5173/auth/confirm'}))
vi.mock('../../lib/publicConfig',()=>({publicConfig:null}))
afterEach(()=>{cleanup();history.replaceState(null,'','/');sessionStorage.clear()})
async function setup(){
 const signInWithOtp=vi.fn().mockResolvedValue({error:null})
 const client={auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}}),signInWithOtp}} as unknown as SupabaseClient<Database>
 render(<AuthGate client={client}>{()=>null}</AuthGate>);await screen.findByLabelText('Adresse email')
 return signInWithOtp
}
const submit=()=>fireEvent.click(screen.getByRole('button',{name:'Recevoir un lien de connexion'}))
it('shows a distinct conditional inbox step, normalizes the address, permits explicit resend and correction',async()=>{
 const send=await setup();fireEvent.change(screen.getByLabelText('Adresse email'),{target:{value:' FICTIF@example.test '}});submit()
 await screen.findByRole('heading',{name:'Consultez votre messagerie'})
 expect(screen.getByRole('status').textContent).toContain('Si cette adresse est connue du club')
 expect(screen.getByText('fictif@example.test',{exact:true})).toBeTruthy();expect(screen.getByText(/courriers indésirables/)).toBeTruthy()
 expect(send).toHaveBeenCalledExactlyOnceWith({email:'fictif@example.test',options:{shouldCreateUser:false,emailRedirectTo:'http://localhost:5173/auth/confirm'}})
 fireEvent.click(screen.getByRole('button',{name:'Demander un nouveau lien'}));await waitFor(()=>expect(send).toHaveBeenCalledTimes(2))
 fireEvent.click(screen.getByRole('button',{name:'Corriger mon adresse'}))
 expect((screen.getByLabelText('Adresse email') as HTMLInputElement).value).toBe('fictif@example.test')
 expect(screen.queryByRole('heading',{name:'Consultez votre messagerie'})).toBeNull();expect(send).toHaveBeenCalledTimes(2)
})
it('unknown-address responses remain indistinguishable and never expose provider details',async()=>{
 const send=await setup();send.mockResolvedValueOnce({error:{status:400,message:'Unknown account SECRET'}})
 fireEvent.change(screen.getByLabelText('Adresse email'),{target:{value:'absent@example.test'}});submit()
 await screen.findByRole('heading',{name:'Consultez votre messagerie'})
 expect(screen.getByRole('status').textContent).toContain('Si cette adresse est connue du club');expect(screen.queryByText(/SECRET/)).toBeNull()
})
it('rate limits show the actual refusal, retain the inbox address, and never retry automatically',async()=>{
 const send=await setup();fireEvent.change(screen.getByLabelText('Adresse email'),{target:{value:'fictif@example.test'}});submit();await screen.findByRole('heading',{name:'Consultez votre messagerie'})
 send.mockResolvedValueOnce({error:{status:429}});fireEvent.click(screen.getByRole('button',{name:'Demander un nouveau lien'}))
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Trop de demandes'))
 expect(screen.getByText('fictif@example.test',{exact:true})).toBeTruthy();expect(send).toHaveBeenCalledTimes(2)
 expect(screen.queryByText(/une minute/)).toBeNull()
})
it('unavailable service retains input without claiming email delivery; busy prevents duplicate sends',async()=>{
 const send=await setup();let finish!:(result:unknown)=>void;send.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 fireEvent.change(screen.getByLabelText('Adresse email'),{target:{value:'fictif@example.test'}});submit()
 const button=screen.getByRole('button',{name:'Demande en cours…'});expect((button as HTMLButtonElement).disabled).toBe(true)
 fireEvent.submit(button.closest('form')!);expect(send).toHaveBeenCalledTimes(1)
 finish({error:{status:503,message:'SECRET'}})
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Connexion au service impossible'))
 expect((screen.getByLabelText('Adresse email') as HTMLInputElement).value).toBe('fictif@example.test')
 expect(screen.queryByRole('heading',{name:'Consultez votre messagerie'})).toBeNull();expect(screen.queryByText(/SECRET/)).toBeNull()
})
