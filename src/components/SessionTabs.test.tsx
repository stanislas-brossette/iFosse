import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SessionTabs } from './SessionTabs'
import type { SessionTab } from './SessionTabs'
afterEach(cleanup)
function Tabs({ admin = false }) { const [value, change] = useState<SessionTab>('overview'); return <SessionTabs value={value} admin={admin} onChange={change} /> }
it('keeps member tabs keyboard accessible without organizer entry', () => {
  render(<Tabs />)
  expect(screen.queryByRole('tab', { name: 'Gestion' })).toBeNull()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Ma participation' }), { key: 'End' })
  expect(screen.getByRole('tab', { name: 'Bilan' }).getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Bilan' }))
  fireEvent.keyDown(document.activeElement!, { key: 'Home' })
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
  expect(screen.getByRole('tab', { name: 'Participants' }).getAttribute('aria-selected')).toBe('true')
})
it('offers real continuation controls on overflow and keeps active tab in view', () => {
  render(<Tabs admin />)
  const rail = screen.getByRole('tablist')
  Object.defineProperties(rail, { scrollWidth: { value: 900 }, clientWidth: { value: 300 }, scrollLeft: { value: 0, writable: true } })
  const scrollTo = vi.fn(); const scrollBy = vi.fn()
  rail.scrollTo = scrollTo; rail.scrollBy = scrollBy
  Object.defineProperties(screen.getByRole('tab', { name: 'Gestion' }), { offsetLeft: { value: 750 }, offsetWidth: { value: 100 } })
  fireEvent(window, new Event('resize'))
  fireEvent.click(screen.getByRole('button', { name: 'Voir les rubriques suivantes' }))
  expect(scrollBy).toHaveBeenCalledOnce()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Ma participation' }), { key: 'End' })
  expect(scrollTo).toHaveBeenCalledOnce()
  rail.scrollLeft = 600; fireEvent.scroll(rail)
  expect(screen.queryByRole('button', { name: 'Voir les rubriques suivantes' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Voir les rubriques précédentes' })).toBeTruthy()
})
