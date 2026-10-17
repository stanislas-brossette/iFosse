export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
export type InstallState = { available: boolean; installed: boolean; standalone: boolean; iosSafari: boolean; busy: boolean; message: string }
export function createInstallController(target: Window) {
  const listeners = new Set<() => void>()
  let prompt: InstallPromptEvent | null = null
  let started = false
  let installed = false
  const media = target.matchMedia?.('(display-mode: standalone)')
  const navigator = target.navigator as Navigator & { standalone?: boolean }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const iosSafari = ios && /Version\/.+Safari\//.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent)
  const standalone = () => !!(media?.matches || navigator.standalone)
  let state: InstallState = { available: false, installed: false, standalone: standalone(), iosSafari, busy: false, message: '' }
  const update = (patch: Partial<InstallState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
  function onPrompt(event: Event) {
    const candidate = event as InstallPromptEvent
    if (installed || standalone() || typeof candidate.prompt !== 'function' || !candidate.userChoice) return
    event.preventDefault()
    prompt = candidate
    update({ available: true, message: '' })
  }
  function onInstalled() { installed = true; prompt = null; update({ installed: true, available: false, busy: false, message: '' }) }
  function onDisplayChange() {
    const isStandalone = standalone()
    if (isStandalone) prompt = null
    update({ standalone: isStandalone, available: !installed && !!prompt && !isStandalone, message: '' })
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() {
      if (started) return
      started = true
      target.addEventListener('beforeinstallprompt', onPrompt)
      target.addEventListener('appinstalled', onInstalled)
      media?.addEventListener?.('change', onDisplayChange)
      onDisplayChange()
    },
    stop() {
      target.removeEventListener('beforeinstallprompt', onPrompt)
      target.removeEventListener('appinstalled', onInstalled)
      media?.removeEventListener?.('change', onDisplayChange)
      started = false
    },
    async install() {
      if (!prompt || state.busy || installed || standalone()) return
      const pending = prompt
      prompt = null // Browser prompts are one-shot; never reuse a consumed event.
      update({ available: false, busy: true, message: '' })
      // Attach a rejection handler even if the browser throws synchronously.
      void pending.userChoice.catch(() => {})
      try {
        const [, choice] = await Promise.all([pending.prompt(), pending.userChoice])
        if (!installed && !standalone()) update({ message: choice.outcome === 'accepted' ? 'Installation demandée.' : 'Installation annulée. Vous pouvez aussi utiliser le menu de votre navigateur.' })
      } catch {
        if (!installed && !standalone()) update({ message: 'Installation indisponible. Essayez depuis le menu de votre navigateur.' })
      } finally { update({ busy: false }) }
    },
  }
}
export const installController = createInstallController(window)
export type InstallController = ReturnType<typeof createInstallController>
