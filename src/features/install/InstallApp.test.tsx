import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createInstallController } from './install'
import type { InstallPromptEvent } from './install'
import { InstallApp } from './InstallApp'
afterEach(cleanup)
function setup({ ios = false, ipad = false, standalone = false, legacy = false } = {}) {
  const target = new EventTarget()
  const media = new EventTarget() as EventTarget & { matches: boolean }
  media.matches = standalone
  const navigator = { userAgent: ios || ipad ? `${ipad ? 'Macintosh' : 'iPhone'} Version/26.0 Mobile/15 Safari/604.1` : 'Chrome/130', platform: ipad ? 'MacIntel' : ios ? 'iPhone' : 'Linux', maxTouchPoints: ipad ? 5 : 1, standalone: false }
  const controller = createInstallController(Object.assign(target, { navigator, matchMedia: () => legacy ? { matches: standalone } : media }) as unknown as Window)
  controller.start()
  const show = () => render(<InstallApp controller={controller} />)
  return { target, media, controller, show, navigator }
}
function offer(target: EventTarget, outcome: 'accepted' | 'dismissed' = 'accepted', prompt = vi.fn(async () => {})) {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome, platform: 'web' }) }) as InstallPromptEvent
  act(() => { target.dispatchEvent(event) })
  return { event, prompt }
}
it('captures availability before profile mounts and only prompts after a deliberate click', async () => {
  const s = setup(); const p = offer(s.target); s.show()
  expect(p.event.defaultPrevented).toBe(true); expect(p.prompt).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Installer iFosse' }))
  await screen.findByText('Installation demandée.'); expect(p.prompt).toHaveBeenCalledTimes(1)
  act(() => { s.target.dispatchEvent(new Event('appinstalled')) })
  expect(screen.queryByRole('heading', { name: 'iFosse sur mon téléphone' })).toBeNull(); s.controller.stop()
})
it('stays invisible without an actual prompt on unsupported browsers', () => { const s = setup(); s.show(); expect(screen.queryByText('Installer iFosse')).toBeNull(); expect(screen.queryByText(/Partager/)).toBeNull(); s.controller.stop() })
it('uses a prompt only once, handles dismissal and can accept a fresh event', async () => {
  const s = setup(); s.show(); const p = offer(s.target, 'dismissed')
  await act(async () => { await Promise.all([s.controller.install(),s.controller.install()]) })
  expect(p.prompt).toHaveBeenCalledTimes(1); expect(screen.getByRole('status').textContent).toContain('Installation annulée')
  expect(screen.queryByRole('button')).toBeNull(); offer(s.target); expect(screen.getByRole('button', { name: 'Installer iFosse' })).toBeTruthy(); s.controller.stop()
})
it.each([false,true])('hides install guidance in standalone mode (iOS=%s)', ios => { const s = setup({ ios,standalone:true }); s.show(); const p = offer(s.target); expect(p.prompt).not.toHaveBeenCalled(); expect(screen.queryByText('iFosse sur mon téléphone')).toBeNull(); s.controller.stop() })
it.each([false,true])('gives Safari/iPad instructions without a fake native prompt (iPad=%s)', ipad => { const s = setup({ ios:true,ipad }); s.show(); expect(screen.getByText(/Partager → Sur l’écran d’accueil/)).toBeTruthy(); expect(screen.queryByRole('button')).toBeNull(); act(() => { s.navigator.standalone=true; s.media.dispatchEvent(new Event('change')) }); expect(screen.queryByText(/Partager/)).toBeNull(); s.controller.stop() })
it('reacts to display mode changes and never reoffers installation after appinstalled', () => { const s = setup(); s.show(); offer(s.target); act(() => { s.media.matches=true; s.media.dispatchEvent(new Event('change')) }); expect(screen.queryByRole('button')).toBeNull(); act(() => { s.media.matches=false; s.media.dispatchEvent(new Event('change')); s.target.dispatchEvent(new Event('appinstalled')) }); offer(s.target); expect(screen.queryByRole('button')).toBeNull(); s.controller.stop() })
it('handles a prompt failure without exposing browser/provider errors', async () => { const s = setup(); s.show(); offer(s.target,'accepted',vi.fn(async()=>{throw Error('private provider detail')})); await act(async()=>{await s.controller.install()}); expect(screen.getByRole('status').textContent).toContain('Installation indisponible'); expect(screen.queryByText(/private provider/)).toBeNull(); expect(screen.queryByRole('button')).toBeNull(); s.controller.stop() })
it('starts idempotently, removes listeners, and tolerates older media-query APIs', () => { const s=setup({legacy:true});s.controller.start();s.controller.stop();offer(s.target);expect(s.controller.getSnapshot().available).toBe(false);s.controller.start();offer(s.target);expect(s.controller.getSnapshot().available).toBe(true);s.controller.stop() })
it('does not mistake iOS Chrome for Safari guidance', () => { const target=Object.assign(new EventTarget(),{navigator:{userAgent:'iPhone CriOS/130 Mobile Safari/604',platform:'iPhone',maxTouchPoints:1}}) as unknown as Window;const s=createInstallController(target);render(<InstallApp controller={s}/>);expect(screen.queryByText(/Partager/)).toBeNull() })
