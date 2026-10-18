import type { Json } from '../../lib/database.types'
import type { Route } from '../../lib/navigation'
export type Notice = { id:string; kind:string; session_id:string|null; title:string; message:string; created_at:string; read_at:string|null }
export type Inbox = { enabled:boolean; unread_count:number; items:Notice[]; has_more:boolean }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const kinds = ['selection_published','selection_changed','carpool_removed','carpool_updated','caci_updated']
export function parseInbox(value:Json):Inbox {
  if (!value || Array.isArray(value) || typeof value !== 'object' || typeof value.enabled !== 'boolean' || typeof value.unread_count !== 'number' || !Number.isSafeInteger(value.unread_count) || value.unread_count<0 || !Array.isArray(value.items) || typeof value.has_more !== 'boolean') throw new Error('Invalid inbox')
  const items = value.items.map(item => {
    if (!item || Array.isArray(item) || typeof item !== 'object' || typeof item.id !== 'string' || !uuid.test(item.id) || typeof item.kind !== 'string' || !kinds.includes(item.kind) || !(item.session_id===null || typeof item.session_id==='string' && uuid.test(item.session_id)) || typeof item.title !== 'string' || typeof item.message !== 'string' || typeof item.created_at !== 'string' || !Number.isFinite(Date.parse(item.created_at)) || !(item.read_at===null || typeof item.read_at==='string' && Number.isFinite(Date.parse(item.read_at)))) throw new Error('Invalid notice')
    return item as Notice
  })
  return { enabled:value.enabled, unread_count:value.unread_count, items, has_more:value.has_more }
}
export function noticeRoute(item:Notice):Route {
  if (item.kind==='caci_updated') return {area:'profile',tab:'overview',view:'upcoming'}
  return {area:'sessions',sessionId:item.session_id ?? undefined,tab:item.kind.startsWith('carpool_')?'transport':'overview',view:'all'}
}
