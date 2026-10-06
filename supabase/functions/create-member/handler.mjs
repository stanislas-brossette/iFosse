import { normalizeMember } from '../_shared/member-input.mjs'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const reply = (status, code) => new Response(JSON.stringify({ code }), { status, headers })
const owned = (user, actor, request) => user.app_metadata?.ifosse_creation_actor === actor && user.app_metadata?.ifosse_creation_request === request

// The factory permits authorization/failure tests without a Deno runtime.
// userClient carries the caller JWT; serviceClient is created ONLY after the
// provider verified that JWT and the database checked the current presidency.
export function createMemberHandler({ userClient, serviceClient }) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, 'METHOD_NOT_ALLOWED')
    const bearer = request.headers.get('Authorization')
    if (!/^Bearer \S+$/i.test(bearer || '')) return reply(401, 'UNAUTHORIZED')
    try {
      const caller = userClient(bearer)
      const identity = await caller.auth.getUser()
      if (identity.error || !identity.data.user) return reply(401, 'UNAUTHORIZED')
      const permission = await caller.rpc('is_president')
      if (permission.error || permission.data !== true) return reply(403, 'PRESIDENT_REQUIRED')
      // Bound input before JSON parsing; no raw body/provider errors are logged.
      const text = await request.text()
      if (text.length > 4096) return reply(400, 'INVALID_MEMBER')
      let input, member
      try {
        input = JSON.parse(text)
        const { request_id, ...fields } = input
        if (typeof request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request_id)) throw new Error()
        input.request_id = request_id.toLowerCase()
        member = normalizeMember(fields)
      } catch { return reply(400, 'INVALID_MEMBER') }
      const actor = identity.data.user.id
      const admin = serviceClient()
      // Search by normalized email, but never adopt an operator/seed/tester
      // identity. Only the same President's marked request can be resumed.
      let user
      for (let page = 1; ; page++) {
        const result = await admin.auth.admin.listUsers({ page, perPage: 100 })
        if (result.error || !result.data?.users) return reply(503, 'CREATION_UNAVAILABLE')
        user = result.data.users.find(candidate => candidate.email?.trim().toLowerCase() === member.email)
        if (user || result.data.users.length < 100) break
      }
      if (user && !owned(user, actor, input.request_id)) return reply(409, 'EMAIL_EXISTS')
      if (!user) {
        const created = await admin.auth.admin.createUser({ email: member.email, email_confirm: true, app_metadata: { ifosse_creation_actor: actor, ifosse_creation_request: input.request_id } })
        if (created.error || !created.data.user) {
          const duplicate = ['email_exists', 'user_already_exists'].includes(created.error?.code)
          return reply(duplicate ? 409 : 503, duplicate ? 'EMAIL_EXISTS' : 'CREATION_UNAVAILABLE')
        }
        user = created.data.user
      }
      // Atomic SQL rechecks Presidency after Auth creation and refuses to link
      // unowned identities. A retry with the same request id repairs an orphan.
      const linked = await caller.rpc('create_member_from_identity', { p_auth_user_id: user.id, p_request_id: input.request_id, p_first_name: member.first_name, p_last_name: member.last_name })
      if (linked.error) return reply(linked.error.code === '42501' ? 403 : linked.error.code === '23505' ? 409 : 503, linked.error.code === '42501' ? 'PRESIDENT_REQUIRED' : linked.error.code === '23505' ? 'EMAIL_EXISTS' : 'CREATION_INCOMPLETE')
      return new Response(JSON.stringify({ member_id: linked.data }), { status: 200, headers })
    } catch { return reply(503, 'CREATION_UNAVAILABLE') }
  }
}
