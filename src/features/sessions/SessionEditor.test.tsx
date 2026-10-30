import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '../../lib/database.types'
import {SessionEditor,type Session} from './SessionEditor'
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
const history:Session={id:'s',date:'2030-10-01',start_time:'21:00:00',end_time:'22:00:00',title:'Fosse',venue:'',address:'',notes:'',capacity:20,registration_open:true,school_holiday:false,status:'open',end_time_estimated:false,created_by:null,created_at:'',updated_at:'',import_source_hash:null,import_source_key:null}
it('does not offer deletion for a session with a published selection or a closed bilan',()=>{
 const rpc=vi.fn()
 const view=render(<SessionEditor client={{rpc} as unknown as SupabaseClient<Database>} session={history} published onSaved={vi.fn()} onCancel={vi.fn()} />)
 expect(screen.queryByRole('button',{name:'Supprimer la séance'})).toBeNull();expect(screen.getByText(/ne peut plus être supprimée/)).toBeTruthy()
 view.rerender(<SessionEditor client={{rpc} as unknown as SupabaseClient<Database>} session={{...history,status:'closed',registration_open:false}} onSaved={vi.fn()} onCancel={vi.fn()} />)
 expect(screen.queryByRole('button',{name:'Supprimer la séance'})).toBeNull();expect(rpc).not.toHaveBeenCalled()
})
it('explains a server refusal to delete a session with recorded attendance',async()=>{
 const onSaved=vi.fn()
 const rpc=vi.fn(async()=>({data:null,error:{code:'22023',message:'Cette séance a un historique (sélection publiée ou présences). Elle ne peut plus être supprimée.'}}))
 render(<SessionEditor client={{rpc} as unknown as SupabaseClient<Database>} session={history} onSaved={onSaved} onCancel={vi.fn()} />)
 fireEvent.click(screen.getByRole('button',{name:'Supprimer la séance'}));fireEvent.click(screen.getByRole('button',{name:'Confirmer la suppression'}))
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('Cette séance a un historique (sélection publiée ou présences). Elle ne peut plus être supprimée.'))
 expect(onSaved).not.toHaveBeenCalled()
})
