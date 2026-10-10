import { getPayload } from 'payload'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { disposeCloudflare, prepareTarget } from './lib/remote-target'
import { assertLegacyMigrationTarget, assertMigrationTarget } from '../src/id-schema'

// prepareTarget writes an explicit remote-only Wrangler config without a
// `previews` block and asserts the resolved D1/R2 IDs before anything connects.
// It must run before src/cloudflare is imported, because that module creates
// the Cloudflare platform proxy at import time.
const pullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request'
if (process.env.CI === 'true' && !['pull_request', 'push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME ?? '')) {
  throw new Error(`Refusing to migrate an unspecified CI target (event ${process.env.GITHUB_EVENT_NAME ?? 'missing'}).`)
}
if (pullRequest) execFileSync('node', ['scripts/pr-preview-resources.mjs', 'ensure'], { stdio: 'inherit', env: process.env })

const prepared = prepareTarget(pullRequest ? 'pr-preview' : 'preview')
const { cloudflare } = await import('../src/cloudflare')

try {
  const {default: config} = await import('../payload.config')
  await assertMigrationTarget(cloudflare.env.D1, prepared.migrationChain)
  const payload = await getPayload({config, disableOnInit: true})
  await payload.db.migrate()
  if (prepared.migrationChain === 'cuid2') await assertMigrationTarget(cloudflare.env.D1, 'cuid2', { allowEmpty: false })
  else await assertLegacyMigrationTarget(cloudflare.env.D1)
  await payload.destroy()
  console.log('Preview D1 migrations applied')
} finally {
  prepared.cleanup()
  await disposeCloudflare(cloudflare)
}

if (pullRequest) {
  // Seed only this isolated PR target with public repository content and its
  // static assets. The importer validates the resource identity again.
  const manifest = JSON.parse(readFileSync('.runtime/pr-preview-resources.json', 'utf8')) as { sha: string }
  if (manifest.sha !== process.env.GITHUB_SHA?.toLowerCase()) throw new Error('PR preview manifest does not match this workflow SHA.')
  execFileSync('bun', ['run', 'import:static', '--', '--target=pr-preview'], { stdio: 'inherit', env: process.env })
}
console.log('Preview D1 migrations applied')
