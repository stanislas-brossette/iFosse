import { useEffect } from 'react'
// The club is small. Visible-page polling avoids an extra public feed for mixed
// tables whose payment, CACI and attendance fields must remain private.
export function useSharedRefresh(load: () => Promise<void>) {
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 5000)
    const focus = () => void load()
    window.addEventListener('focus', focus)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [load])
}
