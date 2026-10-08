import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useSharedRefresh } from './useSharedRefresh'

afterEach(() => { cleanup(); vi.useRealTimers() })
it('lets slow refreshes finish without polling/focus cancelling their final results', async () => {
  vi.useFakeTimers()
  let finish!: () => void
  const load = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  renderHook(() => useSharedRefresh(load))
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); window.dispatchEvent(new Event('focus')) })
  expect(load).toHaveBeenCalledTimes(1)
  await act(async () => { finish() })
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(load).toHaveBeenCalledTimes(2)
  await act(async () => { finish() })
  await act(async () => { window.dispatchEvent(new Event('focus')) })
  expect(load).toHaveBeenCalledTimes(3)
  await act(async () => { finish() })
})
it('starts a new dependency refresh and removes polling/focus listeners on unmount', async () => {
  vi.useFakeTimers()
  let finish!: () => void
  const first = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  const second = vi.fn(async () => {})
  const view = renderHook(({ load }) => useSharedRefresh(load), { initialProps: { load: first as () => Promise<void> } })
  await act(async () => { view.rerender({ load: second }); finish() })
  expect(second).toHaveBeenCalledTimes(1)
  view.unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); window.dispatchEvent(new Event('focus')) })
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
})
