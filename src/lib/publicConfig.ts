import { readPublicConfig } from './config'
// Refer to approved variables individually: importing the whole environment
// object can bundle an accidentally added VITE_* operator credential.
export const publicConfig = readPublicConfig({
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PROJECT_ENV: import.meta.env.VITE_SUPABASE_PROJECT_ENV,
  VITE_PREVIEW_SUPABASE_URL: import.meta.env.VITE_PREVIEW_SUPABASE_URL,
  VITE_PRODUCTION_SUPABASE_URL: import.meta.env.VITE_PRODUCTION_SUPABASE_URL,
})
