import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createOperatorClient, hasControlCharacters } from './operator-client.mjs'

const usage = 'Usage: node scripts/provision-members.mjs ROSTER.json [--apply]\nDefault: validate only. --apply provisions accounts without sending emails.'
const pageSize = 100

export function parseProvisionArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true }
  const paths = args.filter((argument) => !argument.startsWith('--'))
  if (paths.length !== 1 || args.some((argument) => argument.startsWith('--') && argument !== '--apply') || args.filter((argument) => argument === '--apply').length > 1) {
    throw new Error(usage)
  }
  return { path: paths[0], apply: args.includes('--apply') }
}

export function parseRoster(text) {
  let input
  try {
    input = JSON.parse(text)
  } catch {
    throw new Error('The roster must contain valid JSON.')
  }
  if (!Array.isArray(input) || input.length === 0) throw new Error('The roster must be a nonempty JSON array.')
  const emails = new Set()
  return input.map((row, index) => {
    const fail = (description) => { throw new Error(`Roster entry ${index + 1}: ${description}`) }
    if (row === null || typeof row !== 'object' || Array.isArray(row)) fail('expected an object.')
    const keys = Object.keys(row)
    if (keys.length !== 3 || keys.some((key) => !['email', 'first_name', 'last_name'].includes(key))) {
      fail('only email, first_name and last_name are accepted; roles are managed separately.')
    }
    if (typeof row.email !== 'string') fail('email is required.')
    const email = row.email.trim().toLowerCase()
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('email is invalid.')
    if (emails.has(email)) fail('duplicate email address.')
    emails.add(email)
    const names = {}
    for (const field of ['first_name', 'last_name']) {
      if (typeof row[field] !== 'string') fail(`${field} is required.`)
      const value = row[field].trim()
      if (!value || value.length > 100 || hasControlCharacters(value)) fail(`${field} must contain 1 to 100 printable characters.`)
      names[field] = value
    }
    return { email, ...names }
  })
}

async function existingAuthUsers(client) {
  const usersByEmail = new Map()
  for (let page = 1; ; page += 1) {
    let result
    try {
      result = await client.auth.admin.listUsers({ page, perPage: pageSize })
    } catch {
      throw new Error('Unable to read existing Auth users; no accounts were changed.')
    }
    if (result.error || !Array.isArray(result.data?.users)) throw new Error('Unable to read existing Auth users; no accounts were changed.')
    for (const user of result.data.users) {
      if (!user.email) continue
      const email = user.email.trim().toLowerCase()
      if (usersByEmail.has(email) && usersByEmail.get(email).id !== user.id) {
        throw new Error('Existing Auth users contain an ambiguous email; resolve this before importing.')
      }
      usersByEmail.set(email, user)
    }
    if (result.data.users.length < pageSize) return usersByEmail
  }
}

// Auth creation and PostgreSQL are separate transactions. A failed profile write
// leaves the Auth identity intact so a retry can link it without destroying data.
export async function provisionMembers(client, text, { apply = false } = {}) {
  const roster = parseRoster(text) // Validate every entry before any network/write.
  if (!apply) return { validated: roster.length, created: 0, linked: 0, dryRun: true }
  const usersByEmail = await existingAuthUsers(client)
  let created = 0
  let linked = 0
  for (const [index, row] of roster.entries()) {
    let user = usersByEmail.get(row.email)
    if (!user) {
      let result
      try {
        result = await client.auth.admin.createUser({ email: row.email, email_confirm: true })
      } catch {
        throw new Error(`Entry ${index + 1}: Auth provisioning failed. Correct the cause and rerun the same roster; previous entries remain intact.`)
      }
      if (result.error || !result.data?.user?.id) {
        throw new Error(`Entry ${index + 1}: Auth provisioning failed. Correct the cause and rerun the same roster; previous entries remain intact.`)
      }
      user = result.data.user
      usersByEmail.set(row.email, user)
      created += 1
    }
    let result
    try {
      result = await client.rpc('provision_member', {
        p_auth_user_id: user.id,
        p_first_name: row.first_name,
        p_last_name: row.last_name,
      })
    } catch {
      throw new Error(`Entry ${index + 1}: member linking failed. Its Auth identity was kept; rerun the same roster after correcting the cause.`)
    }
    if (result.error) {
      throw new Error(`Entry ${index + 1}: member linking failed. Its Auth identity was kept; rerun the same roster after correcting the cause.`)
    }
    linked += 1
  }
  return { validated: roster.length, created, linked, dryRun: false }
}

async function main() {
  const options = parseProvisionArgs(process.argv.slice(2))
  if (options.help) return console.log(usage)
  let text
  try {
    text = await readFile(options.path, 'utf8')
  } catch {
    throw new Error('Unable to read the roster JSON file.')
  }
  parseRoster(text) // Invalid input must fail even before privileged client setup.
  const result = await provisionMembers(options.apply ? createOperatorClient() : null, text, options)
  console.log(result.dryRun
    ? `Validated ${result.validated} entries. Dry run: no connection, account creation or emails.`
    : `Linked ${result.linked} entries (${result.created} new Auth identities). No emails sent.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
