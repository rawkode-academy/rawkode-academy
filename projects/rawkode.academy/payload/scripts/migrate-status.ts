import { getPayload } from 'payload'
import { parseImportTarget } from './lib/import-target'
import { disposeCloudflare, prepareTarget, TargetError } from './lib/remote-target'

// Check-only: lists registered migrations missing from the target and exits 1
// when any are. It never applies a migration and never writes secrets, so the
// production import tasks can depend on it instead of deploy.migrate.
let target: ReturnType<typeof parseImportTarget>
try {
  target = parseImportTarget(process.argv.slice(2))
} catch (error) {
  if (!(error instanceof TargetError)) throw error
  console.error(error.message)
  process.exit(1)
}

const prepared = prepareTarget(target)
const { cloudflare } = await import('../src/cloudflare')
const { default: config } = await import('../payload.config')
const { migrations } = prepared.migrationChain === 'cuid2'
  ? await import('../src/migrations-cuid2')
  : await import('../src/migrations')
const payload = await getPayload({ config, disableOnInit: true })

try {
  const applied = new Set<string>()
  for (let page = 1; ; page += 1) {
    const found = await payload.find({ collection: 'payload-migrations', limit: 500, page, depth: 0, overrideAccess: true })
    for (const doc of found.docs) if (typeof doc.name === 'string') applied.add(doc.name)
    if (!found.hasNextPage) break
  }
  const missing = migrations.map(migration => migration.name).filter(name => !applied.has(name))
  console.log(JSON.stringify({ target, registered: migrations.length, applied: applied.size, missing }, null, 2))
  if (missing.length) process.exitCode = 1
} finally {
  await payload.destroy()
  await disposeCloudflare(cloudflare)
  prepared.cleanup()
}
