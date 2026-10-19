import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SurpriseBubbles } from './SurpriseBubbles'

let elapsed = 0
let motion: MediaQueryList
let motionChange: (() => void) | undefined
const lastKey = 'ifosse:bubbles:last-shown'
const visitKey = 'ifosse:bubbles:shown-this-visit'
beforeEach(() => {
  vi.useFakeTimers()
  elapsed = 0
  vi.spyOn(performance, 'now').mockImplementation(() => elapsed)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  localStorage.clear(); sessionStorage.clear()
  motion = { matches: false, addEventListener: vi.fn((_name, listener) => { motionChange = listener }), removeEventListener: vi.fn() } as unknown as MediaQueryList
  vi.stubGlobal('matchMedia', () => motion)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
function setup() {
  const action = vi.fn()
  const view = render(<><SurpriseBubbles /><button data-bubbles onClick={action}><span>Consulter</span></button><button>Publier</button></>)
  const click = () => fireEvent.click(screen.getByText('Consulter'), { detail: 1, clientX: 120, clientY: 250 })
  const bubbles = () => document.querySelectorAll('.surprise-bubble')
  return { ...view, action, click, bubbles }
}
it('keeps the normal action, waits five seconds and uses a one-percent chance', () => {
  const { action, click, bubbles } = setup()
  click(); expect(bubbles()).toHaveLength(0)
  elapsed = 4_999; click(); expect(bubbles()).toHaveLength(0)
  elapsed = 5_000
  vi.mocked(Math.random).mockReturnValue(.01)
  click(); expect(bubbles()).toHaveLength(0)
  vi.mocked(Math.random).mockReturnValue(.009)
  click(); expect(bubbles()).toHaveLength(3)
  expect(action).toHaveBeenCalledTimes(4)
  expect(document.querySelector('.surprise-bubbles')?.getAttribute('aria-hidden')).toBe('true')
  expect(document.querySelector('.surprise-bubbles-origin')?.getAttribute('style')).toContain('left: 134px')
  act(() => vi.advanceTimersByTime(1400))
  expect(bubbles()).toHaveLength(0)
  click(); expect(bubbles()).toHaveLength(0)
})
it('preserves the visit limit across remounts and the three-day cooldown across visits', () => {
  const first = setup(); elapsed = 5_000; first.click(); first.unmount()
  const second = setup(); elapsed += 5_000; second.click(); expect(second.bubbles()).toHaveLength(0)
  sessionStorage.clear(); second.click(); expect(second.bubbles()).toHaveLength(0)
  vi.setSystemTime(Date.now() + 3 * 24 * 60 * 60_000)
  second.click(); expect(second.bubbles()).toHaveLength(3)
})
it('never decorates unmarked actions, forms, dialogs, disabled controls or errors', () => {
  const { click, bubbles } = setup(); elapsed = 5_000
  fireEvent.click(screen.getByText('Publier')); expect(bubbles()).toHaveLength(0)
  for (const wrapper of ['form', 'dialog']) {
    const node = document.createElement(wrapper)
    node.innerHTML = '<button data-bubbles>Enregistrer</button>'
    document.body.append(node); fireEvent.click(node.firstElementChild!); node.remove()
    expect(bubbles()).toHaveLength(0)
  }
  const button = screen.getByRole('button', { name: 'Consulter' }) as HTMLButtonElement
  button.disabled = true; click(); expect(bubbles()).toHaveLength(0); button.disabled = false
  const alert = document.createElement('p'); alert.setAttribute('role', 'alert'); document.body.append(alert)
  click(); expect(bubbles()).toHaveLength(0); alert.remove()
  const dialog = document.createElement('dialog'); dialog.setAttribute('open', ''); document.body.append(dialog)
  click(); expect(bubbles()).toHaveLength(0); dialog.remove()
  click(); expect(bubbles()).toHaveLength(3)
})
it('skips reduced motion and clears an active animation when the preference changes', () => {
  const { click, bubbles } = setup(); elapsed = 5_000
  Object.defineProperty(motion, 'matches', { value: true, configurable: true })
  click(); expect(bubbles()).toHaveLength(0)
  Object.defineProperty(motion, 'matches', { value: false })
  click(); expect(bubbles()).toHaveLength(3)
  Object.defineProperty(motion, 'matches', { value: true })
  act(() => motionChange!()); expect(bubbles()).toHaveLength(0)
})
it('skips hidden pages, modified clicks and denied storage without breaking actions', () => {
  const { click, bubbles, action } = setup(); elapsed = 5_000
  Object.defineProperty(document, 'visibilityState', { value: 'hidden' })
  click(); expect(bubbles()).toHaveLength(0)
  Object.defineProperty(document, 'visibilityState', { value: 'visible' })
  fireEvent.click(screen.getByText('Consulter'), { ctrlKey: true }); expect(bubbles()).toHaveLength(0)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied') })
  click(); expect(bubbles()).toHaveLength(0); expect(action).toHaveBeenCalledTimes(3)
})
it('uses the focused control for keyboard activation and cleans up on unmount', () => {
  const { bubbles, unmount } = setup(); elapsed = 5_000
  const button = screen.getByRole('button', { name: 'Consulter' })
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 200, width: 120, height: 44 } as DOMRect)
  fireEvent.click(button, { detail: 0 })
  expect(document.querySelector('.surprise-bubbles-origin')?.getAttribute('style')).toContain('left: 174px')
  expect(bubbles()).toHaveLength(3)
  unmount(); expect(bubbles()).toHaveLength(0)
  localStorage.removeItem(lastKey); sessionStorage.removeItem(visitKey)
  fireEvent.click(button); expect(bubbles()).toHaveLength(0)
  expect(motion.removeEventListener).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
