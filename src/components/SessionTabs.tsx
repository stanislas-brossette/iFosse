import { useEffect, useRef, useState } from 'react'
export type SessionTab = 'overview' | 'participants' | 'transport' | 'manage' | 'bilan' | 'groups'
export function SessionTabs({ value, admin, onChange }: { value: SessionTab; admin: boolean; onChange: (tab: SessionTab) => void }) {
  const rail = useRef<HTMLElement>(null)
  const [edges, setEdges] = useState({ before: false, after: false })
  const tabs: [SessionTab, string][] = [['overview', 'Ma participation'], ['participants', 'Participants'], ['transport', 'Covoiturage'], ['groups', 'Palanquées'], ['bilan', 'Bilan'], ...(admin ? [['manage', 'Gestion'] as [SessionTab, string]] : [])]
  useEffect(() => {
    const node = rail.current!
    const measure = () => setEdges({ before: node.scrollLeft > 2, after: node.scrollLeft + node.clientWidth < node.scrollWidth - 2 })
    node.addEventListener('scroll', measure); window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node); measure()
    return () => { node.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); observer?.disconnect() }
  }, [])
  useEffect(() => {
    // Horizontal scroll only; changing a tab must not move the page vertically.
    const node = rail.current; const active = node?.querySelector<HTMLElement>('[aria-selected=true]')
    if (!node || !active) return
    if (active.offsetLeft < node.scrollLeft + 48) node.scrollTo?.({ left: Math.max(0, active.offsetLeft - 48) })
    else if (active.offsetLeft + active.offsetWidth > node.scrollLeft + node.clientWidth - 48) node.scrollTo?.({ left: active.offsetLeft + active.offsetWidth + 48 - node.clientWidth })
  }, [value])
  function move(direction: number) {
    const node = rail.current!
    node.scrollBy?.({ left: direction * node.clientWidth * .7, behavior: 'smooth' })
  }
  return <div className="session-tabs-container">
    {edges.before && <button className="tabs-scroll before" aria-label="Voir les rubriques précédentes" onClick={() => move(-1)}>‹</button>}
    <nav ref={rail} className="session-tabs" role="tablist" aria-label="Rubriques de la séance">{tabs.map(([key, label], index) => <button key={key} role="tab" id={`session-tab-${key}`} aria-controls="session-panel" aria-selected={value === key} tabIndex={value === key ? 0 : -1} onClick={() => onChange(key)} onKeyDown={event => {
      const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (!offset && event.key !== 'Home' && event.key !== 'End') return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + offset + tabs.length) % tabs.length
      onChange(tabs[next][0]); rail.current?.querySelector<HTMLButtonElement>(`#session-tab-${tabs[next][0]}`)?.focus({ preventScroll: true })
    }}>{label}</button>)}</nav>
    {edges.after && <button className="tabs-scroll after" aria-label="Voir les rubriques suivantes" onClick={() => move(1)}>›</button>}
  </div>
}
