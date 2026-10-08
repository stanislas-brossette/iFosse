import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { notificationHandler } from './handler.mjs'
const keys=['SUPABASE_URL','NOTIFICATION_ENV','NOTIFICATION_ENABLED','NOTIFICATION_DISPATCH_SECRET','NOTIFICATION_STAGING_RECIPIENTS','NOTIFICATION_SENDER_EMAIL','BREVO_API_KEY']
const env=Object.fromEntries(keys.map(key=>[key,Deno.env.get(key)]))
Deno.serve(notificationHandler({env,serviceClient:()=>createClient(env.SUPABASE_URL!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}))
