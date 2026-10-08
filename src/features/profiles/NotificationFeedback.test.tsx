import {act,cleanup,render,screen} from '@testing-library/react'
import {afterEach,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '../../lib/database.types'
import {NotificationFeedback} from './NotificationFeedback'
afterEach(cleanup)
it.each([['pending','en attente'],['accepted','accepté par le service'],['disabled','notifications désactivées'],['suppressed','destinataire exclu'],['uncertain','vérifié par l’opérateur'],['failed','n’a pas pu être envoyé']])('separately reports %s without claiming business failure or delivery',async(status,label)=>{
 const rpc=vi.fn(async()=>({data:status,error:null}));render(<NotificationFeedback client={{rpc} as unknown as SupabaseClient<Database>} receipt={{memberId:'fixture',eventType:'member_reactivated'}} />)
 expect(await screen.findByText(new RegExp(label))).toBeTruthy();expect(rpc).toHaveBeenCalledWith('member_notification_status',{p_member_id:'fixture',p_event_type:'member_reactivated'})
})
it('bounds missing-migration/network feedback without undoing the operation',async()=>{
 const rpc=vi.fn(async()=>({data:null,error:{message:'SECRET_RAW_RESPONSE'}}));render(<NotificationFeedback client={{rpc} as unknown as SupabaseClient<Database>} receipt={{memberId:'fixture',eventType:'member_reactivated'}} />)
 expect(await screen.findByText(/Le statut de l’email est indisponible/)).toBeTruthy();expect(document.body.textContent).not.toContain('SECRET')
})

it('ignores an older receipt response after a newer operation is selected',async()=>{
 let resolve!: (value:{data:string;error:null})=>void
 const first=new Promise<{data:string;error:null}>(done=>{resolve=done})
 const rpc=vi.fn().mockReturnValueOnce(first).mockResolvedValue({data:'pending',error:null})
 const client={rpc} as unknown as SupabaseClient<Database>
 const view=render(<NotificationFeedback client={client} receipt={{memberId:'old',eventType:'member_reactivated'}} />)
 view.rerender(<NotificationFeedback client={client} receipt={{memberId:'new',eventType:'member_deactivated'}} />)
 await screen.findByText(/en attente d’envoi/)
 await act(async()=>resolve({data:'accepted',error:null}))
 expect(screen.queryByText(/accepté par le service/)).toBeNull()
})
