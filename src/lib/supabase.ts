import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { readPublicConfig } from './config'

const config = readPublicConfig(import.meta.env)
export const supabase = config ? createClient<Database>(config.url, config.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
}) : null
