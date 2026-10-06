import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { createMemberHandler } from './handler.mjs'

const url = Deno.env.get('SUPABASE_URL')!
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
Deno.serve(createMemberHandler({
  userClient: (authorization: string) => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { ...options, global: { headers: { Authorization: authorization } } }),
  serviceClient: () => createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options),
}))
