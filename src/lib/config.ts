export type AppEnvironment = 'local' | 'preview' | 'production'
export type PublicConfig = { environment: AppEnvironment; url: string; key: string }

/** Validate the deliberately small browser configuration at build and runtime. */
export function readPublicConfig(env: Record<string, string | undefined>): PublicConfig | null {
  const allowed = ['VITE_APP_ENV', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_PROJECT_ENV', 'VITE_PREVIEW_SUPABASE_URL', 'VITE_PRODUCTION_SUPABASE_URL']
  if (Object.keys(env).some(name => name.startsWith('VITE_') && !allowed.includes(name))) throw new Error('Variable navigateur non autorisée. Utilisez uniquement la configuration publique prévue.')
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
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('URL Supabase invalide.')
  if (environment !== 'local') {
    const preview = env.VITE_PREVIEW_SUPABASE_URL
    const production = env.VITE_PRODUCTION_SUPABASE_URL
    if (!preview || !production) throw new Error('Les URL distinctes des projets preview et production doivent être fixées.')
    const stagingUrl = new URL(preview)
    const productionUrl = new URL(production)
    if ([stagingUrl, productionUrl].some(value => value.protocol !== 'https:' || value.username || value.password || value.search || value.hash || value.pathname !== '/')) throw new Error('URL de projet hébergé invalide.')
    if (stagingUrl.origin === productionUrl.origin) throw new Error('Preview et production nécessitent deux projets distincts.')
    if (parsed.origin !== (environment === 'preview' ? stagingUrl.origin : productionUrl.origin)) throw new Error('Le projet Supabase ne correspond pas à l’URL fixée pour cet environnement.')
  }
  let publicKey = key.startsWith('sb_publishable_')
  if (!publicKey) {
    try { publicKey = JSON.parse(atob(key.split('.')[1] ?? '')).role === 'anon' } catch { /* Not an anonymous JWT. */ }
  }
  if (!publicKey) throw new Error('Seule une clé publique Supabase est autorisée dans le navigateur.')
  return { environment: environment as AppEnvironment, url, key }
}
