import { describe, expect, it } from 'vitest'
import { loginRedirectUrl } from './redirect'

describe('magic-link redirect origin boundary', () => {
  it.each([
    'https://ifosse-staging.netlify.app',
    'https://deploy-preview-54--ifosse-staging.netlify.app',
    'https://master--ifosse-staging.netlify.app',
    'https://deploy-preview-54--ifosse.netlify.app',
    'https://staging--ifosse.netlify.app',
  ])('preserves the allowed preview origin %s', origin => {
    expect(loginRedirectUrl(origin, 'preview')).toBe(`${origin}/auth/confirm`)
    expect(loginRedirectUrl(origin, 'production')).toBeNull()
  })
  it.each(['localhost:5173', '127.0.0.1:5173', 'localhost:4173', '127.0.0.1:4173'])('supports local %s', host => {
    expect(loginRedirectUrl(`http://${host}`, 'local')).toBe(`http://${host}/auth/confirm`)
    expect(loginRedirectUrl(`http://${host}`, 'preview')).toBeNull()
  })
  it('isolates the production origin', () => {
    expect(loginRedirectUrl('https://ifosse.netlify.app', 'production')).toBe('https://ifosse.netlify.app/auth/confirm')
    expect(loginRedirectUrl('https://ifosse.netlify.app', 'preview')).toBeNull()
    expect(loginRedirectUrl('https://ifosse-staging.netlify.app', 'local')).toBeNull()
  })
  it.each([
    'https://evil.netlify.app', 'https://deploy-preview-54--other.netlify.app',
    'https://deploy-preview-54--ifosse-staging.netlify.app.evil.test',
    'https://feature--ifosse-staging.netlify.app', 'https://deploy-preview-abc--ifosse-staging.netlify.app',
    'http://ifosse-staging.netlify.app', 'https://ifosse-staging.netlify.app:444',
    'https://user@ifosse-staging.netlify.app', 'https://ifosse-staging.netlify.app/path',
    'https://ifosse-staging.netlify.app?redirect=https://evil.test', 'not a URL',
  ])('rejects unexpected or non-origin input %s', origin => {
    expect(loginRedirectUrl(origin, 'preview')).toBeNull()
  })
})
