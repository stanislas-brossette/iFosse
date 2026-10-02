export function todayParis(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (key: string) => parts.find(part => part.type === key)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export type CaciStatus = 'missing' | 'expired' | 'soon' | 'valid'
export const caciLabels: Record<CaciStatus, string> = { missing: 'Non renseigné', expired: 'Expiré', soon: 'Expire bientôt', valid: 'Valide' }
export function caciStatus(expiry: string | null, reference = todayParis()): CaciStatus {
  if (!expiry) return 'missing'
  const days = (Date.parse(expiry) - Date.parse(reference)) / 86_400_000
  if (!Number.isFinite(days)) return 'missing'
  return days < 0 ? 'expired' : days <= 60 ? 'soon' : 'valid'
}
