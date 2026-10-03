// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { parseCalendar, parseCalendarArgs, importCalendar } from './import-calendar.mjs'
const source = await readFile(new URL('../data/calendar-2026-2027.json', import.meta.url), 'utf8')
const first = JSON.parse(source)[0]
const second = JSON.parse(source)[1]
describe('reviewed real calendar import', () => {
  it('keeps only the 11 image dates and makes missing ends/addresses explicit', () => {
    const rows = parseCalendar(source)
    expect(rows).toHaveLength(11)
    expect(rows.filter(row => row.end_time_estimated).map(row => row.date)).toEqual(['2026-11-04', '2026-12-09'])
    expect(rows.every(row => row.address === '')).toBe(true)
    expect(rows.map(row => row.date)).not.toContain('2026-09-09')
    expect(rows.map(row => row.date)).not.toContain('2026-09-23')
  })
  it('defaults to offline validation and requires an explicit target for applying', async () => {
    expect(parseCalendarArgs(['calendar.json'])).toEqual({ path: 'calendar.json', apply: false })
    expect(() => parseCalendarArgs(['calendar.json', '--apply'])).toThrow('target-url')
    expect(parseCalendarArgs(['calendar.json', '--apply', '--target-url', 'https://project.example.test'])).toEqual({ path: 'calendar.json', apply: true, target: 'https://project.example.test' })
    expect(() => parseCalendarArgs(['calendar.json', '--apply', '--target-url', 'https://secret@project.example.test'])).toThrow('Usage')
    expect(await importCalendar(null, source)).toEqual({ validated: 11, estimatedEnds: 2, missingAddresses: 11, dryRun: true })
  })
  it('rejects fictitious dates, duplicate entries, unknown fields and invalid times before any write', async () => {
    const client = { rpc: vi.fn() }
    for (const bad of [{ ...first, date: '2026-09-09' }, { ...second, end_time: '20:00' }, { ...second, start_time: '24:00' }, { ...second, role: 'admin' }, { ...second, school_holiday: 'yes' }, { ...second, title: '' }]) {
      await expect(importCalendar(client, JSON.stringify([first, bad]), { apply: true })).rejects.toThrow('entry 2')
    }
    expect(() => parseCalendar(JSON.stringify([first, first]))).toThrow('duplicate')
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('makes one transactional RPC and reports created versus retained sessions', async () => {
    const client = { rpc: vi.fn(async () => ({ data: [{ created: false }], error: null })) }
    expect(await importCalendar(client, JSON.stringify([first]), { apply: true })).toEqual({ validated: 1, created: 0, retained: 1, dryRun: false })
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('import_season_calendar', { p_sessions: [first] })
    client.rpc.mockResolvedValueOnce({ data: null, error: { message: 'provider-secret-sentinel' } })
    await expect(importCalendar(client, JSON.stringify([first]), { apply: true })).rejects.toThrow('provider details are not printed')
  })
})
