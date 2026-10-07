import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './lib/database.types'
import type { Member } from './features/auth/AuthGate'
import App from './App'
const dependencies = vi.hoisted(() => ({ client: null as SupabaseClient<Database> | null }))
vi.mock('./lib/publicConfig', () => ({ publicConfig: null }))
vi.mock('./lib/supabase', () => ({ get supabase() { return dependencies.client } }))
vi.mock('./features/sessions/Sessions', () => ({ Sessions: () => <h1>Les séances</h1> }))
vi.mock('./features/profiles/Profile', () => ({ Profile: () => <h1>Mon profil</h1> }))
vi.mock('./features/profiles/Directory', () => ({ Directory: () => <h1>Gestion des adhérents</h1> }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })
async function setup() {
  vi.spyOn(window,'scrollTo').mockImplementation(() => {})
  window.history.replaceState(null,'','/')
  let notify!: (event: AuthChangeEvent, session: Session | null) => void
  let id='a'
  const session=()=>({user:{id}} as Session)
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{id,auth_user_id:id,first_name:'Anne',last_name:'Fictif',role:'member',disabled_at:null} as Member,error:null})}
  const signOut=vi.fn(async()=>{notify('SIGNED_OUT',null);return {error:null}})
  dependencies.client={auth:{getSession:async()=>({data:{session:session()},error:null}),onAuthStateChange:(callback:typeof notify)=>{notify=callback;return {data:{subscription:{unsubscribe:vi.fn()}}}},signOut},from:()=>query} as unknown as SupabaseClient<Database>
  render(<App />)
  await screen.findByRole('heading',{name:'Les séances'})
  return {signOut,signIn:async(next='a')=>{id=next;await act(async()=>notify('SIGNED_IN',session()));await screen.findByRole('button',{name:'Ouvrir mon profil'})}}
}
it.each(['avatar','name','role'])('opens the current profile when clicking the %s without logging out', async target=>{
  const app=await setup()
  const identity=screen.getByRole('button',{name:'Ouvrir mon profil'})
  fireEvent.click(target==='avatar'?identity.querySelector('.avatar')!:target==='name'?screen.getByText('Anne Fictif'):screen.getByText('Adhérent'))
  expect(screen.getByRole('heading',{name:'Mon profil'})).toBeTruthy()
  expect(screen.getByRole('button',{name:'Mon profil'}).getAttribute('aria-current')).toBe('page')
  expect(identity.getAttribute('type')).toBe('button')
  expect(app.signOut).not.toHaveBeenCalled()
  expect(window.scrollTo).toHaveBeenCalledWith({top:0})
})
it('keeps logout separate with local scope and resets navigation on same-account relogin', async()=>{
  const app=await setup()
  fireEvent.click(screen.getByRole('button',{name:'Ouvrir mon profil'}))
  const logout=screen.getByRole('button',{name:'Se déconnecter'})
  expect(logout.closest('.identity')).toBeNull()
  await act(async()=>fireEvent.click(logout))
  expect(app.signOut).toHaveBeenCalledWith({scope:'local'})
  expect(screen.getByRole('heading',{name:'Connexion à iFosse'})).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Ouvrir mon profil'})).toBeNull()
  await app.signIn()
  expect(screen.getByRole('heading',{name:'Les séances'})).toBeTruthy()
  expect(screen.queryByRole('heading',{name:'Mon profil'})).toBeNull()
})
it('starts another account on sessions rather than retaining the previous profile page',async()=>{
  const app=await setup();fireEvent.click(screen.getByRole('button',{name:'Ouvrir mon profil'}))
  await app.signIn('b')
  await screen.findByRole('heading',{name:'Les séances'})
  expect(screen.queryByRole('heading',{name:'Mon profil'})).toBeNull()
})
