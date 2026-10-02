import { describe, expect, it } from 'vitest'
import { readLoginCallback } from './callback'

describe('magic-link boundary', () => {
  it('accepts only the fixed confirmation route and email action', () => {
    expect(readLoginCallback('/', '#token_hash=' + 'a'.repeat(64) + '&type=email')).toBeNull()
    expect(readLoginCallback('/auth/confirm', '#token_hash=' + 'a'.repeat(64) + '&type=email')).toEqual({ tokenHash: 'a'.repeat(64) })
    expect(readLoginCallback('/auth/confirm', '#token_hash=' + 'a'.repeat(64) + '&type=recovery')).toEqual({ invalid: true })
  })
  it('rejects missing, duplicate, or malformed tokens', () => {
    for (const hash of ['', '#token_hash=bad&type=email', '#token_hash=' + 'a'.repeat(64) + '&token_hash=' + 'b'.repeat(64) + '&type=email']) {
      expect(readLoginCallback('/auth/confirm', hash)).toEqual({ invalid: true })
    }
  })
})
