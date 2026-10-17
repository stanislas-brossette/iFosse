export type LoginCallback = { tokenHash: string } | { invalid: true } | null

export function readLoginCallback(pathname: string, hash: string): LoginCallback {
  if (pathname !== '/auth/confirm') return null
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const tokenHash = params.get('token_hash') ?? ''
  if (params.getAll('token_hash').length !== 1 || params.getAll('type').length !== 1 || params.get('type') !== 'email' || !/^[a-zA-Z0-9_-]{20,512}$/.test(tokenHash)) {
    return { invalid: true }
  }
  return { tokenHash }
}

// Keep the pasted-link fallback in the installed app on its own environment.
// Reuse exactly the callback's token/type validation and explicit confirmation.
export function readSameOriginLoginLink(value: string, origin: string): LoginCallback {
  try {
    if (value.length > 2048) return { invalid: true }
    const url = new URL(value.trim())
    if (url.origin !== origin || url.username || url.password || url.search || url.pathname !== '/auth/confirm') return { invalid: true }
    return readLoginCallback(url.pathname, url.hash)
  } catch { return { invalid: true } }
}
