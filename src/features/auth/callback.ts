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
