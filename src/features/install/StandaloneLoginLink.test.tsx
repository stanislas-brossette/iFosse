import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { afterEach,expect,it,vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import { AuthGate } from '../auth/AuthGate'
import { installController } from './install'
vi.mock('../auth/redirect',()=>({loginRedirectUrl:()=>`${window.location.origin}/auth/confirm`}))
vi.mock('../../lib/publicConfig',()=>({publicConfig:null}))
const token='fictitious_token_hash_12345678901234567890'
afterEach(()=>{cleanup();installController.stop();Object.defineProperty(navigator,'standalone',{configurable:true,value:false});installController.start();installController.stop();history.replaceState(null,'','/');sessionStorage.clear()})
async function setup(standalone=true,verificationError=false){
 Object.defineProperty(navigator,'standalone',{configurable:true,value:standalone});installController.start()
 const verifyOtp=vi.fn(async()=>({error:verificationError?{message:'expired'}:null}))
 const client={auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}}),signInWithOtp:vi.fn(async()=>({error:null})),verifyOtp}} as unknown as SupabaseClient<Database>
 render(<AuthGate client={client}>{()=>null}</AuthGate>);await screen.findByLabelText('Adresse email');fireEvent.change(screen.getByLabelText('Adresse email'),{target:{value:'fictif@example.test'}});fireEvent.click(screen.getByRole('button',{name:'Recevoir un lien de connexion'}));await screen.findByRole('heading',{name:'Consultez votre messagerie'});return {verifyOtp}
}
it('accepts a pasted same-origin email link in installed mode, clears it and still requires explicit confirmation',async()=>{
 const {verifyOtp}=await setup();fireEvent.click(screen.getByText('Le lien ouvre mon navigateur au lieu d’iFosse'))
 const input=screen.getByLabelText('Lien de connexion reçu par email') as HTMLInputElement
 expect(input.type).toBe('password');fireEvent.change(input,{target:{value:`${location.origin}/auth/confirm#token_hash=${token}&type=email`}});fireEvent.submit(input.closest('form')!)
 await screen.findByRole('heading',{name:'Confirmer la connexion'});expect(input.value).toBe('');expect(verifyOtp).not.toHaveBeenCalled();expect(location.hash).toBe('');expect(document.body.textContent).not.toContain(token)
 fireEvent.click(screen.getByRole('button',{name:'Se connecter'}));await waitFor(()=>expect(verifyOtp).toHaveBeenCalledExactlyOnceWith({token_hash:token,type:'email'}));expect(location.pathname).toBe('/seances')
})
it('rejects another environment without invoking Auth or echoing the supplied link',async()=>{const {verifyOtp}=await setup();const input=screen.getByLabelText('Lien de connexion reçu par email') as HTMLInputElement;fireEvent.change(input,{target:{value:`https://other.invalid/auth/confirm#token_hash=${token}&type=email`}});fireEvent.submit(input.closest('form')!);expect(screen.getByRole('alert').textContent).toContain('ne correspond pas');expect(verifyOtp).not.toHaveBeenCalled();expect(input.value).toBe('');expect(document.body.textContent).not.toContain('other.invalid')})
it('keeps the existing expired/reused-token response',async()=>{const {verifyOtp}=await setup(true,true);const input=screen.getByLabelText('Lien de connexion reçu par email');fireEvent.change(input,{target:{value:`${location.origin}/auth/confirm#token_hash=${token}&type=email`}});fireEvent.submit(input.closest('form')!);fireEvent.click(await screen.findByRole('button',{name:'Se connecter'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('expiré'));expect(verifyOtp).toHaveBeenCalledTimes(1)})
it('does not add a fallback form in a normal browser',async()=>{await setup(false);expect(screen.queryByLabelText('Lien de connexion reçu par email')).toBeNull()})
