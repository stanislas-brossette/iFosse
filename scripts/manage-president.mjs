import { pathToFileURL } from 'node:url'
import { createOperatorClient, hasControlCharacters, parseMemberId } from './operator-client.mjs'

const usage = 'Usage: node scripts/manage-president.mjs bootstrap MEMBER_UUID [--apply]\n       node scripts/manage-president.mjs recover MEMBER_UUID --reason "Detailed operator reason" [--apply]\nDefault: validate only. The service-only RPC audits bootstrap/recovery.'

export function parsePresidentArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true }
  const [command, target, ...options] = args
  if (!['bootstrap', 'recover'].includes(command)) throw new Error(usage)
  const memberId = parseMemberId(target)
  let apply = false
  let reason
  for (let index = 0; index < options.length; index += 1) {
    if (options[index] === '--apply' && !apply) apply = true
    else if (options[index] === '--reason' && reason === undefined && options[index + 1] && !options[index + 1].startsWith('--')) reason = options[++index].trim()
    else throw new Error(usage)
  }
  if (command === 'bootstrap' && reason !== undefined) throw new Error(usage)
  if (command === 'recover' && (!reason || reason.length < 20 || reason.length > 500 || hasControlCharacters(reason))) {
    throw new Error('Recovery requires --reason with 20 to 500 printable characters explaining the operator intervention.')
  }
  return { command, memberId, reason, apply }
}

export async function managePresident(client, options) {
  if (!options.apply) return { dryRun: true }
  const rpc = options.command === 'bootstrap' ? 'bootstrap_president' : 'recover_president'
  const args = { p_member_id: options.memberId }
  if (options.command === 'recover') args.p_reason = options.reason
  let result
  try {
    result = await client.rpc(rpc, args)
  } catch {
    throw new Error('President operation failed. Check the target member and database preconditions; no provider details are logged.')
  }
  if (result.error) throw new Error('President operation failed. Check the target member and database preconditions; no provider details are logged.')
  return { dryRun: false }
}

async function main() {
  const options = parsePresidentArgs(process.argv.slice(2))
  if (options.help) return console.log(usage)
  const result = await managePresident(options.apply ? createOperatorClient() : null, options)
  console.log(result.dryRun
    ? 'Validated president operation. Dry run: no connection or role change.'
    : 'President operation completed and audited.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
