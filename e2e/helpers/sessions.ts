import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types.js'
import { seasonOf, todayParis } from '../../src/lib/dates.js'
export const testSessionDate = `${seasonOf(todayParis()) + 1}-08-02`
export async function createSession(client: SupabaseClient<Database>, title: string, capacity = 2) {
  const result = await client.rpc('save_session', { p_date: testSessionDate, p_start_time: '21:00', p_end_time: '22:00', p_title: title, p_venue: 'Piscine fictive', p_address: '', p_notes: '', p_capacity: capacity, p_registration_open: true, p_school_holiday: false, p_end_time_estimated: false })
  if (result.error || !result.data) throw new Error(`Local test session creation failed (${result.error?.code ?? 'missing_session'}).`)
  return result.data
}
export async function setCapacity(client: SupabaseClient<Database>, id: string, title: string, capacity: number) {
  return client.rpc('save_session', { p_id: id, p_date: testSessionDate, p_start_time: '21:00', p_end_time: '22:00', p_title: title, p_venue: 'Piscine fictive', p_address: '', p_notes: '', p_capacity: capacity, p_registration_open: true, p_school_holiday: false, p_end_time_estimated: false })
}
