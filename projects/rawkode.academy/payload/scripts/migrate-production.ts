import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

const projectDir = process.cwd()
const sourceConfigPath = path.join(projectDir, 'wrangler.jsonc')
const sourceConfig = JSON.parse(readFileSync(sourceConfigPath, 'utf8')) as {
  name: string
  account_id?: string
  main: string
  compatibility_date: string
  compatibility_flags?: string[]
  d1_databases?: Record<string, unknown>[]
  r2_buckets?: Record<string, unknown>[]
  vars?: Record<string, string>
}

if (!sourceConfig.d1_databases?.length || !sourceConfig.r2_buckets?.length) {
  throw new Error('wrangler.jsonc must define production D1 and R2 bindings before remote migration')
}

// getPlatformProxy uses preview IDs when the Wrangler config contains a
// `previews` block. Build a small, explicit migration config so this command
// can never silently target the preview database.
const remoteBindings = <T extends Record<string, unknown>>(bindings: T[]) => bindings.map(binding => ({...binding, remote: true}))
const runtimeDir = path.join(projectDir, '.runtime')
const migrationConfigPath = path.join(runtimeDir, 'wrangler.production-migration.json')

mkdirSync(runtimeDir, {recursive: true})
writeFileSync(migrationConfigPath, JSON.stringify({
  name: `${sourceConfig.name}-migration`,
  account_id: sourceConfig.account_id,
  main: sourceConfig.main,
  compatibility_date: sourceConfig.compatibility_date,
  compatibility_flags: sourceConfig.compatibility_flags,
  workers_dev: false,
  d1_databases: remoteBindings(sourceConfig.d1_databases),
  r2_buckets: remoteBindings(sourceConfig.r2_buckets),
  vars: sourceConfig.vars,
}, null, 2))

process.env.POC_CLI = '1'
process.env.POC_REMOTE_BINDINGS = '1'
process.env.POC_CLOUDFLARE_CONFIG_PATH = migrationConfigPath
process.env.POC_CLOUDFLARE_ENV_FILE = path.join(projectDir, '.dev.vars')

// Import after setting the proxy configuration. The module initializes the
// Cloudflare platform proxy at import time.
const { cloudflare } = await import('../src/cloudflare')

try {
  const {default: config} = await import('../payload.config')
  const payload = await getPayload({config, disableOnInit: true})
  await payload.db.migrate()
  await payload.destroy()
  console.log('Production D1 migrations applied')
} finally {
  rmSync(migrationConfigPath, {force: true})
  if ('dispose' in cloudflare && typeof cloudflare.dispose === 'function') {
    await cloudflare.dispose()
  }
}
