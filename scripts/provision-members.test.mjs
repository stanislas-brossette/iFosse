// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { parseProvisionArgs, parseRoster, provisionMembers } from './provision-members.mjs'
import { managePresident, parsePresidentArgs } from './manage-president.mjs'
import { readServiceConfig } from './operator-client.mjs'

const memberId = '10000000-0000-0000-0000-000000000001'
const roster = JSON.stringify([{ email: 'member@example.test', first_name: 'Camille', last_name: 'Bernard' }])

function fakeClient(users = []) {
  return {
    auth: {
      admin: {
        listUsers: vi.fn(async ({ page, perPage }) => ({ data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null })),
        createUser: vi.fn(async ({ email }) => ({ data: { user: { id: memberId, email } }, error: null })),
      },
    },
    rpc: vi.fn(async () => ({ data: memberId, error: null })),
  }
}

describe('safe roster provisioning', () => {
  it('normalizes a roster without importing application permissions', () => {
    expect(parseRoster('[{"email":"  CAMILLE@EXAMPLE.TEST ","first_name":" Camille ","last_name":" Bernard "}]'))
      .toEqual([{ email: 'camille@example.test', first_name: 'Camille', last_name: 'Bernard' }])
    expect(() => parseRoster('[{"email":"member@example.test","first_name":"Camille","last_name":"Bernard","role":"president"}]')).toThrow('roles are managed separately')
    expect(() => parseRoster('[{"email":"member@example.test","first_name":"Camille","last_name":"Bernard"},{"email":" MEMBER@example.test ","first_name":"Other","last_name":"Name"}]')).toThrow('duplicate')
  })

  it('validates the whole input before any provider call, including a bad final entry', async () => {
    const client = fakeClient()
    const input = '[{"email":"member@example.test","first_name":"Camille","last_name":"Bernard"},{"email":"other@example.test","first_name":"","last_name":"Other"}]'
    await expect(provisionMembers(client, input, { apply: true })).rejects.toThrow('entry 2')
    expect(client.auth.admin.listUsers).not.toHaveBeenCalled()
    expect(client.auth.admin.createUser).not.toHaveBeenCalled()
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('defaults to an offline dry run without requiring a privileged client', async () => {
    expect(parseProvisionArgs(['members.json'])).toEqual({ path: 'members.json', apply: false })
    await expect(provisionMembers(null, roster)).resolves.toEqual({ validated: 1, created: 0, linked: 0, dryRun: true })
    expect(() => parseProvisionArgs(['members.json', '--service-role-key', 'do-not-log-this'])).toThrow('Usage:')
  })

  it('finds an existing identity beyond the first Auth page and delegates only profile linkage', async () => {
    const users = Array.from({ length: 100 }, (_, index) => ({ id: `existing-${index}`, email: `existing-${index}@example.test` }))
    users.push({ id: memberId, email: 'MEMBER@example.test', app_metadata: { existing: 'preserved' } })
    const client = fakeClient(users)
    await expect(provisionMembers(client, roster, { apply: true })).resolves.toEqual({ validated: 1, created: 0, linked: 1, dryRun: false })
    expect(client.auth.admin.listUsers).toHaveBeenCalledTimes(2)
    expect(client.auth.admin.createUser).not.toHaveBeenCalled()
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('provision_member', {
      p_auth_user_id: memberId, p_first_name: 'Camille', p_last_name: 'Bernard',
    })
  })

  it('creates an email-confirmed identity without a password, invitation or role metadata', async () => {
    const client = fakeClient()
    await provisionMembers(client, roster, { apply: true })
    expect(client.auth.admin.createUser).toHaveBeenCalledExactlyOnceWith({ email: 'member@example.test', email_confirm: true })
  })

  it('keeps an Auth identity after a linking failure and repairs it on retry without recreating it', async () => {
    const client = fakeClient()
    client.rpc.mockResolvedValueOnce({ error: { message: 'provider secret should not be logged' } })
    await expect(provisionMembers(client, roster, { apply: true })).rejects.toThrow('Its Auth identity was kept')
    client.auth.admin.listUsers.mockResolvedValue({ data: { users: [{ id: memberId, email: 'member@example.test' }] }, error: null })
    await expect(provisionMembers(client, roster, { apply: true })).resolves.toMatchObject({ created: 0, linked: 1 })
    expect(client.auth.admin.createUser).toHaveBeenCalledTimes(1)
  })

  it('does not disclose provider messages and stops before further entries after an Auth failure', async () => {
    const client = fakeClient()
    client.auth.admin.createUser.mockRejectedValue(new Error('sensitive credential'))
    const input = '[{"email":"member@example.test","first_name":"Camille","last_name":"Bernard"},{"email":"other@example.test","first_name":"Other","last_name":"Name"}]'
    await expect(provisionMembers(client, input, { apply: true })).rejects.toThrow('Entry 1: Auth provisioning failed')
    await expect(provisionMembers(client, input, { apply: true })).rejects.not.toThrow('sensitive credential')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('fails closed when existing Auth email resolution is ambiguous', async () => {
    const client = fakeClient([{ id: 'a', email: 'member@example.test' }, { id: 'b', email: 'MEMBER@example.test' }])
    await expect(provisionMembers(client, roster, { apply: true })).rejects.toThrow('ambiguous email')
    expect(client.auth.admin.createUser).not.toHaveBeenCalled()
    expect(client.rpc).not.toHaveBeenCalled()
  })
})

describe('president operator actions', () => {
  it('requires an explicit apply and meaningful recovery reason for a known UUID target', async () => {
    const options = parsePresidentArgs(['bootstrap', memberId])
    await expect(managePresident(null, options)).resolves.toEqual({ dryRun: true })
    expect(() => parsePresidentArgs(['recover', memberId, '--reason', 'oops', '--apply'])).toThrow('20 to 500')
    expect(() => parsePresidentArgs(['bootstrap', 'member@example.test', '--apply'])).toThrow('UUID')
    expect(() => parsePresidentArgs(['bootstrap', memberId, '--reason', 'Not a recovery operation'])).toThrow('Usage:')
  })

  it('calls the audited service-only recovery RPC with the supplied reason', async () => {
    const client = fakeClient()
    const reason = 'President account is inaccessible; approved club recovery.'
    const options = parsePresidentArgs(['recover', memberId, '--reason', reason, '--apply'])
    await expect(managePresident(client, options)).resolves.toEqual({ dryRun: false })
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('recover_president', { p_member_id: memberId, p_reason: reason })
  })

  it('calls bootstrap without permitting arbitrary role input', async () => {
    const client = fakeClient()
    await managePresident(client, parsePresidentArgs(['bootstrap', memberId, '--apply']))
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('bootstrap_president', { p_member_id: memberId })
    expect(() => parsePresidentArgs(['bootstrap', memberId, '--role', 'admin', '--apply'])).toThrow('Usage:')
  })
})

describe('operator credentials', () => {
  it('takes secrets from environment only and requires HTTPS outside localhost', () => {
    expect(readServiceConfig({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'operator-key' }))
      .toEqual({ url: 'http://127.0.0.1:54321', key: 'operator-key' })
    expect(() => readServiceConfig({ SUPABASE_URL: 'http://remote.example.test', SUPABASE_SERVICE_ROLE_KEY: 'operator-key' })).toThrow('HTTPS')
    expect(() => readServiceConfig({ SUPABASE_URL: 'https://operator-key@remote.example.test', SUPABASE_SERVICE_ROLE_KEY: 'operator-key' })).toThrow('without credentials')
    expect(() => readServiceConfig({ VITE_SUPABASE_URL: 'https://remote.example.test', VITE_SUPABASE_SERVICE_ROLE_KEY: 'operator-key' })).toThrow('operator environment')
  })
})
