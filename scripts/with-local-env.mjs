#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { resolve } from 'node:path'

// This wrapper starts only a frontend process. Privileged local credentials stay
// in the parent process and are never added to Vite's environment or output.
const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('Usage: node scripts/with-local-env.mjs <command> [arguments]')
  process.exit(2)
}

let status
try {
  status = JSON.parse(execFileSync(resolve('node_modules/.bin/supabase'), ['status', '--output', 'json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }))
} catch {
  console.error('Local Supabase is unavailable. Run npm run db:start first.')
  process.exit(1)
}

const localUrl = new URL(status.API_URL)
if (!['localhost', '127.0.0.1', '[::1]'].includes(localUrl.hostname) || localUrl.protocol !== 'http:') {
  console.error('The browser test harness accepts only a local Supabase stack.')
  process.exit(1)
}
const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY
if (!publicKey) {
  console.error('The local Supabase public key is unavailable.')
  process.exit(1)
}

const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/^VITE_|SUPABASE|IFOSSE_E2E|^(SERVICE_ROLE_KEY|SECRET_KEY|JWT_SECRET|ANON_KEY|PUBLISHABLE_KEY|DB_URL)$/i.test(name),
))
Object.assign(env, {
  VITE_APP_ENV: 'local',
  VITE_SUPABASE_PROJECT_ENV: 'local',
  VITE_SUPABASE_URL: status.API_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
})

const child = spawn(command, args, { env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', () => {
  console.error('Unable to start the local frontend command.')
  process.exitCode = 1
})
child.on('exit', code => { process.exitCode = code ?? 1 })
