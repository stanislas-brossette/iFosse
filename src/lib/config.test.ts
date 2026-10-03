import { describe, expect, it } from 'vitest'
import { readPublicConfig } from './config'

const config = { VITE_APP_ENV: 'local', VITE_SUPABASE_PROJECT_ENV: 'local', VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }
describe('browser configuration boundary', () => {
  it('allows an unconfigured local shell', () => expect(readPublicConfig({})).toBeNull())
  it('accepts local public configuration', () => expect(readPublicConfig(config)?.environment).toBe('local'))
  it('rejects a privileged key', () => expect(() => readPublicConfig({ ...config, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test' })).toThrow('clé publique'))
  it('rejects a service-role JWT', () => expect(() => readPublicConfig({ ...config, VITE_SUPABASE_PUBLISHABLE_KEY: `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature` })).toThrow('clé publique'))
  it('accepts the legacy anonymous key format', () => expect(readPublicConfig({ ...config, VITE_SUPABASE_PUBLISHABLE_KEY: `header.${btoa(JSON.stringify({ role: 'anon' }))}.signature` })).not.toBeNull())
  it('requires explicit hosted configuration', () => expect(() => readPublicConfig({ VITE_APP_ENV: 'preview' })).toThrow('incomplète'))
  it('rejects inherited production configuration in preview', () => expect(() => readPublicConfig({ ...config, VITE_APP_ENV: 'preview', VITE_SUPABASE_PROJECT_ENV: 'production' })).toThrow('correspondre'))
  it('requires HTTPS for hosted projects', () => expect(() => readPublicConfig({ ...config, VITE_APP_ENV: 'preview', VITE_SUPABASE_PROJECT_ENV: 'preview' })).toThrow('HTTPS'))
})

const hosted = { ...config, VITE_APP_ENV: 'preview', VITE_SUPABASE_PROJECT_ENV: 'preview', VITE_SUPABASE_URL: 'https://staging.example.test', VITE_PREVIEW_SUPABASE_URL: 'https://staging.example.test', VITE_PRODUCTION_SUPABASE_URL: 'https://production.example.test' }
describe('hosted project isolation', () => {
  it('accepts explicit distinct project mappings for each context', () => {
    expect(readPublicConfig(hosted)?.environment).toBe('preview')
    expect(readPublicConfig({ ...hosted, VITE_APP_ENV: 'production', VITE_SUPABASE_PROJECT_ENV: 'production', VITE_SUPABASE_URL: hosted.VITE_PRODUCTION_SUPABASE_URL })?.environment).toBe('production')
  })
  it('rejects preview pointing at production even if its marker says preview', () => {
    expect(() => readPublicConfig({ ...hosted, VITE_SUPABASE_URL: hosted.VITE_PRODUCTION_SUPABASE_URL })).toThrow('URL fixée')
    expect(() => readPublicConfig({ ...hosted, VITE_PREVIEW_SUPABASE_URL: hosted.VITE_PRODUCTION_SUPABASE_URL })).toThrow('distincts')
    expect(() => readPublicConfig({ ...hosted, VITE_PRODUCTION_SUPABASE_URL: undefined })).toThrow('fixées')
  })
  it('refuses unexpected browser-prefixed variables before they can be bundled', () => {
    expect(() => readPublicConfig({ ...config, VITE_SERVICE_ROLE_KEY: 'sentinel-never-bundle' })).toThrow('non autorisée')
    expect(() => readPublicConfig({ VITE_DATABASE_PASSWORD: 'sentinel-never-bundle' })).toThrow('non autorisée')
  })
})
