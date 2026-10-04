export type SessionTab = 'overview' | 'participants' | 'transport' | 'manage' | 'bilan' | 'groups'
export function SessionTabs({ value, admin, onChange }: { value: SessionTab; admin: boolean; onChange: (tab: SessionTab) => void }) {
  const tabs: [SessionTab, string][] = [['overview', 'Ma participation'], ['participants', 'Participants'], ['transport', 'Covoiturage'], ['groups', 'Palanquées'], ['bilan', 'Bilan'], ...(admin ? [['manage', 'Gestion'] as [SessionTab, string]] : [])]
  return <nav className="session-tabs" role="tablist" aria-label="Rubriques de la séance">{tabs.map(([key, label], index) => <button key={key} role="tab" id={`session-tab-${key}`} aria-controls="session-panel" aria-selected={value === key} tabIndex={value === key ? 0 : -1} onClick={() => onChange(key)} onKeyDown={event => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!offset && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + offset + tabs.length) % tabs.length
    onChange(tabs[next][0]); document.getElementById(`session-tab-${tabs[next][0]}`)?.focus()
  }}>{label}</button>)}</nav>
}
