export type AppEnvironment = 'local' | 'preview' | 'production'
export type PublicConfig = { environment: AppEnvironment; url: string; key: string }

/** Validate the deliberately small browser configuration at build and runtime. */
export function readPublicConfig(env: Record<string, string | undefined>): PublicConfig | null {
  const environment = env.VITE_APP_ENV ?? 'local'
  if (!['local', 'preview', 'production'].includes(environment)) throw new Error('Environnement inconnu.')
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url && !key && environment === 'local') return null
  if (!url || !key) throw new Error('Configuration Supabase incomplète.')
  if (env.VITE_SUPABASE_PROJECT_ENV !== environment) throw new Error('Le projet Supabase doit correspondre à cet environnement.')
  const parsed = new URL(url)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !(environment === 'local' && local && parsed.protocol === 'http:')) {
    throw new Error('Supabase nécessite HTTPS hors développement local.')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('URL Supabase invalide.')
  let publicKey = key.startsWith('sb_publishable_')
  if (!publicKey) {
    try { publicKey = JSON.parse(atob(key.split('.')[1] ?? '')).role === 'anon' } catch { /* Not an anonymous JWT. */ }
  }
  if (!publicKey) throw new Error('Seule une clé publique Supabase est autorisée dans le navigateur.')
  return { environment: environment as AppEnvironment, url, key }
}
