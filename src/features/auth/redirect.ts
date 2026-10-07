import type { AppEnvironment } from '../../lib/config'

// Only the current browser origin is considered. No URL/search parameter can
// supply a redirect target. Provider-side allow-lists remain mandatory.
export function loginRedirectUrl(origin: string, environment: AppEnvironment): string | null {
  let url: URL
  try { url = new URL(origin) } catch { return null }
  if (url.origin !== origin || url.username || url.password) return null
  if (environment === 'local') {
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
      && ['5173', '4173'].includes(url.port) ? `${origin}/auth/confirm` : null
  }
  if (url.protocol !== 'https:' || url.port) return null
  if (environment === 'production') return origin === 'https://ifosse.netlify.app' ? `${origin}/auth/confirm` : null
  const mainStaging = url.hostname === 'ifosse-staging.netlify.app'
  // Both sites' deploy previews use the staging Supabase project (README matrix).
  const preview = /^deploy-preview-[1-9][0-9]*--ifosse(?:-staging)?\.netlify\.app$/.test(url.hostname)
  const branch = ['master--ifosse-staging.netlify.app', 'staging--ifosse.netlify.app'].includes(url.hostname)
  return mainStaging || preview || branch ? `${origin}/auth/confirm` : null
}
