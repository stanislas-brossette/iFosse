export const sortLabels = { registration: 'Inscription', name: 'Nom', level: 'Niveau', selection: 'Sélection' } as const
export type SortKey = keyof typeof sortLabels
export type SortPreference = { key: SortKey; descending: boolean }
export const defaultSort: SortPreference = { key: 'registration', descending: false }
const storageKey = 'ifosse:participant-sort'
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
// Display ordering only: teaching qualifications are not diving equivalences.
const levels = ['N0', 'N1', 'N2', 'N3', 'N4', 'N5', 'E1', 'E2', 'E3', 'MF1', 'E4', 'MF2']
const states = ['SELECTED', 'WAITING', 'PENDING', 'DECLINED', 'WITHDRAWN', 'NONE']
type Participant = { member_id: string; first_name: string; last_name: string; current_level?: string | null; state?: string | null; registered_at?: string | null }
function rank(value: string | null | undefined, order: string[]) {
  const result = order.indexOf(value?.trim().toUpperCase() ?? '')
  return result < 0 ? null : result
}
function levelRank(value?: string | null) {
  const normalized = value?.trim().toUpperCase()
  return rank(normalized === 'DÉBUTANT' || normalized === 'DEBUTANT' ? 'N0' : normalized, levels)
}
function compareKnown(a: number | null, b: number | null, direction: number) {
  return a === null ? b === null ? 0 : 1 : b === null ? -1 : (a - b) * direction
}
function timestamp(value?: string | null) { const n = Date.parse(value ?? ''); return Number.isFinite(n) ? n : null }
export function sortParticipants<T extends Participant>(rows: readonly T[], sort: SortPreference): T[] {
  const direction = sort.descending ? -1 : 1
  const name = (a: T, b: T) => collator.compare(a.last_name, b.last_name) || collator.compare(a.first_name, b.first_name)
  const registration = (a: T, b: T, sign = 1) => compareKnown(timestamp(a.registered_at), timestamp(b.registered_at), sign)
  return [...rows].sort((a, b) => {
    let primary = 0
    if (sort.key === 'registration') primary = registration(a, b, direction)
    if (sort.key === 'name') primary = name(a, b) * direction
    if (sort.key === 'level') primary = compareKnown(levelRank(a.current_level), levelRank(b.current_level), direction)
    if (sort.key === 'selection') primary = compareKnown(rank(a.state, states), rank(b.state, states), direction)
    return primary || registration(a, b) || name(a, b) || a.member_id.localeCompare(b.member_id)
  })
}
export function readSort(): SortPreference {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
    if (value && Object.hasOwn(sortLabels, value.key) && typeof value.descending === 'boolean') return { key: value.key, descending: value.descending }
  } catch { /* Blocked storage or an old preference: use the default. */ }
  return defaultSort
}
export function saveSort(value: SortPreference) {
  try { sessionStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Sorting still works without storage. */ }
}
