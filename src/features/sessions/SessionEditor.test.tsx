import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '../../lib/database.types'
import {SessionEditor} from './SessionEditor'
afterEach(cleanup)
it('associates the known end-time constraint with its field and keeps other input on refusal',async()=>{
 const rpc=vi.fn(async()=>({data:null,error:{code:'23514',message:'violates "sessions_end_time_check" SECRET'}}))
 render(<SessionEditor client={{rpc} as unknown as SupabaseClient<Database>} onSaved={vi.fn()} onCancel={vi.fn()} />)
 fireEvent.change(screen.getByLabelText('Fin'),{target:{value:'19:00'}});fireEvent.change(screen.getByLabelText('Informations pour les adhérents'),{target:{value:'Note fictive conservée'}})
 fireEvent.submit(screen.getByRole('button',{name:'Enregistrer la séance'}).closest('form')!)
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('L’heure de fin doit être après l’heure de début, le même jour.'))
 expect(screen.getByLabelText('Fin').getAttribute('aria-invalid')).toBe('true');expect(screen.getByLabelText('Fin').getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
 expect((screen.getByLabelText('Informations pour les adhérents') as HTMLTextAreaElement).value).toBe('Note fictive conservée');expect(screen.queryByText(/SECRET/)).toBeNull()
})
