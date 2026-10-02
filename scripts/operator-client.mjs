import { createClient } from '@supabase/supabase-js'

// This module belongs to Node operator scripts, never to the browser bundle.
export function readServiceConfig(env = process.env) {
  const rawUrl = env.SUPABASE_URL?.trim()
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!rawUrl || !key) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the operator environment.')
  }
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('SUPABASE_URL must be a valid Supabase project URL.')
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/'
  ) {
    throw new Error('SUPABASE_URL must use HTTPS (or local HTTP) without credentials or extra paths.')
  }
  return { url: url.origin, key }
}

export function createOperatorClient(env = process.env) {
  const { url, key } = readServiceConfig(env)
  try {
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  } catch {
    throw new Error('Unable to initialize the operator client; check the environment configuration.')
  }
}

export function hasControlCharacters(value) {
  return [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
}

export function parseMemberId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('The target must be an existing member UUID.')
  }
  return value.toLowerCase()
}
