import { useCallback, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { useSharedRefresh } from '../../lib/useSharedRefresh'
import { PresidencyTransfer } from './PresidencyTransfer'

// Mounted only on the President's own profile; existing RLS still authorizes
// every directory read. Keep the displayed successor snapshot current.
export function ProfilePresidency({client,member,refresh,onTransferred}:{client:SupabaseClient<Database>;member:Member;refresh:()=>Promise<void>;onTransferred:(successor:Member)=>Promise<void>}) {
  const [members,setMembers]=useState<Member[]>([])
  const [error,setError]=useState('')
  const sequence=useRef(0)
  const load=useCallback(async()=>{
    const request=++sequence.current
    try {
      const result=await client.from('members').select('*').order('last_name')
      if(request!==sequence.current)return
      if(result.error){setError('Le choix du successeur est indisponible. Réessayez.');return}
      setMembers(result.data ?? []);setError('')
    }catch{if(request===sequence.current)setError('Le choix du successeur est indisponible. Réessayez.')}
  },[client])
  useSharedRefresh(load)
  return <div className="mt">
    {error && <p role="alert">{error}</p>}
    <PresidencyTransfer client={client} current={member} members={members} onReload={load} onStart={start=>start()} onAccessChanged={async()=>{setError('Vérifiez votre rôle avant toute nouvelle tentative de transfert.');await refresh()}} onTransferred={onTransferred} />
  </div>
}
