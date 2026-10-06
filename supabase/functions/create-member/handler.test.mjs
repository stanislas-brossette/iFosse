// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createMemberHandler } from './handler.mjs'
const requestId = 'aaaa0000-0000-4000-8000-000000000001'
const actor = 'bbbb0000-0000-4000-8000-000000000001'
const input = { request_id: requestId, email: ' Camille@EXAMPLE.TEST ', first_name: ' Camille ', last_name: ' Bernard ' }
function setup({ president = true, users = [], identityError = null, sqlError = null } = {}) {
  const caller = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: actor } }, error: identityError })) }, rpc: vi.fn(async name => name === 'is_president' ? { data: president, error: null } : { data: 'member-id', error: sqlError }) }
  const admin = { auth: { admin: { listUsers: vi.fn(async ({ page, perPage }) => ({ data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null })), createUser: vi.fn(async fields => ({ data: { user: { id: 'auth-id', ...fields } }, error: null })) } } }
  const serviceClient = vi.fn(() => admin)
  const handler = createMemberHandler({ userClient: () => caller, serviceClient })
  const invoke = (body = input, authorization = 'Bearer verified-token') => handler(new Request('https://edge.example.test/create-member', { method: 'POST', headers: authorization ? { Authorization: authorization } : {}, body: JSON.stringify(body) }))
  return { caller, admin, serviceClient, invoke, handler }
}
describe('President member creation boundary', () => {
  it.each([false, null])('rejects non-President callers before any privileged access (%s)', async president => {
    const app = setup({ president }); expect((await app.invoke()).status).toBe(403)
    expect(app.serviceClient).not.toHaveBeenCalled()
  })
  it('requires a provider-verified bearer, not just JWT claims', async () => {
    const app = setup({ identityError: { message: 'secret provider response' } })
    expect((await app.invoke()).status).toBe(401)
    expect((await app.invoke(input, '')).status).toBe(401)
    expect(app.serviceClient).not.toHaveBeenCalled()
  })
  it.each([{ ...input, role: 'admin' }, { ...input, first_name: '\n' }, { ...input, request_id: 'no' }, { ...input, email: 'bad' }])('rejects invalid or privileged fields before any Auth write', async invalid => {
    const app = setup(); expect((await app.invoke(invalid)).status).toBe(400)
    expect(app.serviceClient).not.toHaveBeenCalled()
  })
  it('creates a normalized confirmed identity without password/invitation and finalizes under caller JWT', async () => {
    const app = setup(); expect((await app.invoke()).status).toBe(200)
    expect(app.admin.auth.admin.createUser).toHaveBeenCalledExactlyOnceWith({ email: 'camille@example.test', email_confirm: true, app_metadata: { ifosse_creation_actor: actor, ifosse_creation_request: requestId } })
    expect(app.caller.rpc).toHaveBeenLastCalledWith('create_member_from_identity', { p_auth_user_id: 'auth-id', p_request_id: requestId, p_first_name: 'Camille', p_last_name: 'Bernard' })
  })
  it.each([{}, { ifosse_creation_actor: 'another', ifosse_creation_request: requestId }, { ifosse_creation_actor: actor, ifosse_creation_request: 'different' }])('never adopts or modifies existing tester/seed/operator accounts', async app_metadata => {
    const app = setup({ users: [{ id: 'existing', email: 'CAMILLE@example.test', app_metadata }] })
    expect((await app.invoke()).status).toBe(409)
    expect(app.admin.auth.admin.createUser).not.toHaveBeenCalled()
    expect(app.caller.rpc).toHaveBeenCalledTimes(1)
  })
  it.each(['email_exists', 'user_already_exists'])('reports concurrent provider duplicates clearly without linking (%s)', async code => {
    const app = setup()
    app.admin.auth.admin.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code, message: 'sensitive provider diagnostic' } })
    const response = await app.invoke(); expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ code: 'EMAIL_EXISTS' })
    expect(app.caller.rpc).toHaveBeenCalledTimes(1)
  })
  it('resumes only the same marked request, including a lost success response', async () => {
    const app = setup({ users: [...Array.from({ length: 100 }, (_, i) => ({ email: `other-${i}@example.test` })), { id: 'owned', email: 'camille@example.test', app_metadata: { ifosse_creation_actor: actor, ifosse_creation_request: requestId } }] })
    expect((await app.invoke()).status).toBe(200); expect((await app.invoke()).status).toBe(200)
    expect(app.admin.auth.admin.createUser).not.toHaveBeenCalled()
    expect(app.admin.auth.admin.listUsers).toHaveBeenCalledTimes(4)
    expect(app.caller.rpc).toHaveBeenLastCalledWith('create_member_from_identity', expect.objectContaining({ p_auth_user_id: 'owned' }))
  })
  it('fails closed if Presidency is revoked after Auth creation; retains the marked identity for repair', async () => {
    const app = setup({ sqlError: { code: '42501', message: 'sensitive provider data' } })
    const response = await app.invoke(); expect(response.status).toBe(403)
    expect(await response.text()).toBe('{"code":"PRESIDENT_REQUIRED"}')
    expect(app.admin.auth.admin.createUser).toHaveBeenCalledTimes(1)
  })
  it('keeps retry feedback bounded and never returns provider diagnostics', async () => {
    const app = setup({ sqlError: { code: 'XX000', message: 'service key secret' } })
    const response = await app.invoke(); expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ code: 'CREATION_INCOMPLETE' })
    app.admin.auth.admin.listUsers.mockRejectedValueOnce(new Error('secret'))
    expect(await (await app.invoke()).json()).toEqual({ code: 'CREATION_UNAVAILABLE' })
  })
})
