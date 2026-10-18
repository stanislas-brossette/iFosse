import { useEffect } from 'react'
// The club is small. Visible-page polling avoids an extra public feed for mixed
// tables whose payment, CACI and attendance fields must remain private.
export function useSharedRefresh(load: () => Promise<void>) {
  useEffect(() => {
    // A slow multi-query refresh must finish before polling starts another:
    // otherwise sequence guards can repeatedly discard its final response.
    let loading = false
    let disposed = false
    const refresh = async () => {
      if (loading || disposed) return
      loading = true
      try { await load() } finally { loading = false }
    }
    void refresh()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 5000)
    const focus = () => void refresh()
    window.addEventListener('focus', focus)
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [load])
}
