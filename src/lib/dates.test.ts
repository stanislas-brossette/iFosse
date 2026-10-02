import { expect, it } from 'vitest'
import { caciStatus, todayParis } from './dates'
it('uses the Paris calendar day even when UTC is the previous day', () => {
  expect(todayParis(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02')
})
it('keeps CACI valid on its expiry day and uses the inclusive 60-day warning boundary', () => {
  expect(caciStatus(null, '2026-10-02')).toBe('missing')
  expect(caciStatus('infinity', '2026-10-02')).toBe('missing')
  expect(caciStatus('2026-10-01', '2026-10-02')).toBe('expired')
  expect(caciStatus('2026-10-02', '2026-10-02')).toBe('soon')
  expect(caciStatus('2026-12-01', '2026-10-02')).toBe('soon')
  expect(caciStatus('2026-12-02', '2026-10-02')).toBe('valid')
})
it('evaluates on the session date across month and leap-year boundaries', () => {
  expect(caciStatus('2028-02-29', '2028-03-01')).toBe('expired')
  expect(caciStatus('2026-11-01', '2026-12-01')).toBe('expired')
})
import { seasonBounds, seasonOf } from './dates'
it('keeps August and September in their respective seasons with exclusive end bounds', () => {
  expect(seasonOf('2027-08-31')).toBe(2026)
  expect(seasonOf('2027-09-01')).toBe(2027)
  expect(seasonOf('2028-02-29')).toBe(2027)
  expect(seasonBounds(2026)).toEqual({ start: '2026-09-01', end: '2027-09-01' })
})
