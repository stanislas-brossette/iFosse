import type { CurrentSelection } from './Selection'
import type { Readiness } from '../payments/Payments'
export type DraftState = 'selected' | 'waiting' | 'declined'
export const draftLabels = { selected: 'Retenu dans le brouillon', waiting: 'En attente', declined: 'Non retenu' }
export type ManagementPerson = CurrentSelection & { draftState: DraftState; completedCount: number | null; readiness?: Readiness }
export type ManagementFilters = { waiting: boolean; caci: boolean; transport: boolean; unpaid: boolean }
export const emptyFilters: ManagementFilters = { waiting: false, caci: false, transport: false, unpaid: false }
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
export function managementRows(rows: ManagementPerson[], search: string, filters: ManagementFilters, key: 'name' | 'count', descending: boolean) {
  const name = (a: ManagementPerson, b: ManagementPerson) => collator.compare(a.last_name, b.last_name) || collator.compare(a.first_name, b.first_name)
  return rows.filter(person => `${person.first_name} ${person.last_name}`.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'))
    && (!filters.waiting || person.draftState === 'waiting')
    && (!filters.caci || !person.readiness || person.readiness.caci_status !== 'valid')
    && (!filters.transport || !person.readiness || !person.readiness.transport_ready || person.readiness.transport_provisional)
    && (!filters.unpaid || !person.readiness || !person.readiness.payment_ready))
    .sort((a,b) => {
      const direction = descending ? -1 : 1
      let primary = name(a,b) * direction
      if (key === 'count') primary = a.completedCount === null ? b.completedCount === null ? 0 : 1 : b.completedCount === null ? -1 : (a.completedCount-b.completedCount)*direction
      return primary || name(a,b) || a.member_id.localeCompare(b.member_id)
    })
}
export type PublishPreview = { fingerprint: string; publication_version: number; capacity: number; rows: { member_id: string; first_name: string; last_name: string; published_state: string; draft_state: string }[] }
export function parsePublishPreview(value: unknown): PublishPreview | null {
  if (!value || typeof value !== 'object') return null
  const p = value as PublishPreview
  if (typeof p.fingerprint !== 'string' || !/^[a-f0-9]{32}$/.test(p.fingerprint) || !Number.isInteger(p.publication_version) || !Number.isInteger(p.capacity) || !Array.isArray(p.rows)) return null
  if (!p.rows.every(r => r && ['member_id','first_name','last_name','published_state','draft_state'].every(k => typeof r[k as keyof typeof r] === 'string'))) return null
  return p
}
export function publicationChanges(preview: PublishPreview) {
  return {
    added: preview.rows.filter(r => r.draft_state === 'selected' && r.published_state !== 'selected'),
    removed: preview.rows.filter(r => r.published_state === 'selected' && r.draft_state !== 'selected'),
    other: preview.rows.filter(r => r.draft_state !== r.published_state && r.draft_state !== 'selected' && r.published_state !== 'selected'),
    selectedCount: preview.rows.filter(r => r.draft_state === 'selected').length,
  }
}
