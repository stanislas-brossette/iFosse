import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createOperatorClient, hasControlCharacters, readServiceConfig } from './operator-client.mjs'
const dates = new Set(['2026-10-28', '2026-11-04', '2026-12-09', '2027-01-13', '2027-02-10', '2027-02-26', '2027-03-16', '2027-03-31', '2027-04-07', '2027-04-23', '2027-05-12'])
const keys = ['address', 'date', 'end_time', 'end_time_estimated', 'notes', 'school_holiday', 'start_time', 'title', 'venue']
const usage = 'Usage: npm run calendar:import -- CALENDAR.json [--apply --target-url https://PROJECT.supabase.co]\nDefault: offline validation only.'
export function parseCalendarArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true }
  const [path, ...rest] = args
  if (!path || path.startsWith('--')) throw new Error(usage)
  if (!rest.length) return { path, apply: false }
  if (rest.length !== 3 || rest[0] !== '--apply' || rest[1] !== '--target-url') throw new Error(usage)
  let target
  try { target = new URL(rest[2]) } catch { throw new Error(usage) }
  if (target.username || target.password || target.search || target.hash || target.pathname !== '/') throw new Error(usage)
  return { path, apply: true, target: target.origin }
}
export function parseCalendar(text) {
  let rows
  try { rows = JSON.parse(text) } catch { throw new Error('Calendar must be valid JSON.') }
  if (!Array.isArray(rows) || !rows.length || rows.length > 11) throw new Error('Expected 1–11 real calendar sessions.')
  const seen = new Set()
  return rows.map((row, index) => {
    const fail = reason => { throw new Error(`Calendar entry ${index + 1}: ${reason}`) }
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).sort().join(',') !== keys.join(',')) fail('unexpected fields.')
    if (!dates.has(row.date) || seen.has(row.date)) fail('unknown/fictitious or duplicate date.')
    seen.add(row.date)
    for (const time of ['start_time', 'end_time']) if (typeof row[time] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row[time])) fail('invalid time.')
    if (row.end_time <= row.start_time) fail('end must follow start on the same day.')
    for (const flag of ['end_time_estimated', 'school_holiday']) if (typeof row[flag] !== 'boolean') fail('invalid explicit flag.')
    for (const [field, max] of [['title', 100], ['venue', 150], ['address', 250], ['notes', 1500]]) {
      if (typeof row[field] !== 'string' || row[field].length > max || hasControlCharacters(row[field]) || (field === 'title' && !row[field].trim())) fail('invalid session text.')
    }
    return row
  })
}
export async function importCalendar(client, text, { apply = false } = {}) {
  const rows = parseCalendar(text)
  if (!apply) return { validated: rows.length, estimatedEnds: rows.filter(row => row.end_time_estimated).length, missingAddresses: rows.filter(row => !row.address.trim()).length, dryRun: true }
  const result = await client.rpc('import_season_calendar', { p_sessions: rows })
  if (result.error || result.data?.length !== rows.length) throw new Error('Calendar import failed. Check the target/migration and source conflicts; provider details are not printed.')
  return { validated: rows.length, created: result.data.filter(row => row.created).length, retained: result.data.filter(row => !row.created).length, dryRun: false }
}
async function main() {
  const args = parseCalendarArgs(process.argv.slice(2))
  if (args.help) { console.log(usage); return }
  const text = await readFile(args.path, 'utf8')
  parseCalendar(text) // Validate the complete file before credentials or API calls.
  if (args.apply && readServiceConfig().url !== args.target) throw new Error('Explicit target URL does not match SUPABASE_URL.')
  console.log(JSON.stringify(await importCalendar(args.apply ? createOperatorClient() : null, text, args)))
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Calendar import failed. Run --help, validate the input and check the operator environment/target. No credentials are printed.'); process.exitCode = 1 })
