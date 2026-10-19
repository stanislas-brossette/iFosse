import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'

const lastShownKey = 'ifosse:bubbles:last-shown'
const visitKey = 'ifosse:bubbles:shown-this-visit'
const warmup = 5_000
const cooldown = 3 * 24 * 60 * 60_000
const lifetime = 1400
type Burst = { x: number; y: number; bubbles: CSSProperties[] }

// Decorative only. Explicit opt-in keeps saves, confirmations and errors out.
export function SurpriseBubbles() {
  const [burst, setBurst] = useState<Burst | null>(null)
  useEffect(() => {
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!motion) return
    const started = performance.now()
    let shown = false
    let timer: ReturnType<typeof setTimeout> | undefined
    function clear() { clearTimeout(timer); setBurst(null) }
    function click(event: MouseEvent) {
      if (shown || motion!.matches || document.visibilityState !== 'visible' || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || performance.now() - started < warmup) return
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-bubbles]') : null
      if (!button || button.disabled || button.closest('[hidden], [inert], dialog, form, [role="dialog"], [aria-busy="true"]') || document.querySelector('dialog[open], [role="alert"]')) return
      try {
        const last = Number(localStorage.getItem(lastShownKey))
        if (sessionStorage.getItem(visitKey) || (Number.isFinite(last) && last > 0 && Date.now() - last < cooldown) || Math.random() >= .01) return
        // If storage is unavailable, skip the surprise rather than repeat it.
        localStorage.setItem(lastShownKey, String(Date.now()))
        sessionStorage.setItem(visitKey, '1')
      } catch { return }
      shown = true
      const rect = button.getBoundingClientRect()
      const x = event.detail === 0 ? rect.left + rect.width / 2 : event.clientX
      const y = event.detail === 0 ? rect.top + rect.height / 2 : event.clientY
      setBurst({
        x: Math.max(24, Math.min(window.innerWidth - 24, x + 14)),
        y: Math.max(24, Math.min(window.innerHeight - 24, y - 8)),
        bubbles: Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
          '--bubble-size': `${5 + Math.random() * 7}px`,
          '--bubble-x': `${-12 + Math.random() * 24}px`,
          '--bubble-drift': `${-15 + Math.random() * 30}px`,
          '--bubble-rise': `${48 + Math.random() * 38}px`,
          '--bubble-duration': `${900 + Math.random() * 260}ms`,
          '--bubble-delay': `${Math.random() * 180}ms`,
        } as CSSProperties)),
      })
      timer = setTimeout(clear, lifetime)
    }
    function motionChanged() { if (motion!.matches) clear() }
    function visibilityChanged() { if (document.visibilityState !== 'visible') clear() }
    document.addEventListener('click', click)
    document.addEventListener('visibilitychange', visibilityChanged)
    motion.addEventListener('change', motionChanged)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', click)
      document.removeEventListener('visibilitychange', visibilityChanged)
      motion.removeEventListener('change', motionChanged)
    }
  }, [])
  return burst && createPortal(<div className="surprise-bubbles" aria-hidden="true">
    <div className="surprise-bubbles-origin" style={{ left: burst.x, top: burst.y }}>
      {burst.bubbles.map((style, index) => <span className="surprise-bubble" key={index} style={style} />)}
    </div>
  </div>, document.body)
}
