import { getPayload } from 'payload'
import { parseImportTarget } from './lib/import-target'
import { disposeCloudflare, prepareTarget, TargetError } from './lib/remote-target'
import { assertLegacyMigrationTarget, assertMigrationTarget } from '../src/id-schema'

// Applies the target-selected chain. Production selects CUID2 but its existing
// integer D1 is rejected before migrate(); it becomes eligible only after the
// reviewed export/reseed and matching D1 binding cutover.
//
// prepareTarget writes an explicit remote-only Wrangler config without a
// `previews` block and asserts the resolved D1/R2 IDs before anything connects.
// It must run before src/cloudflare is imported, because that module creates
// the Cloudflare platform proxy at import time.
const argv = process.argv.slice(2)
let target: ReturnType<typeof parseImportTarget>
try {
  target = argv.some(argument => argument === '--target' || argument.startsWith('--target=')) ? parseImportTarget(argv) : 'production'
} catch (error) {
  if (!(error instanceof TargetError)) throw error
  console.error(error.message)
  process.exit(1)
}

// A future production cutover may provision the new D1 first and then apply
// its initial CUID2 chain explicitly. Normal production deploys never pass
// this one-time operator flag and therefore reject an empty database.
const initializeEmptyProductionCuid2 = argv.includes('--initialize-empty-cuid2-production')
if (initializeEmptyProductionCuid2 && target !== 'production') {
  throw new Error('--initialize-empty-cuid2-production is only valid with --target=production.')
}

const prepared = prepareTarget(target)
const { cloudflare } = await import('../src/cloudflare')

try {
  const {default: config} = await import('../payload.config')
  await assertMigrationTarget(cloudflare.env.D1, prepared.migrationChain, {
    allowEmpty: target !== 'production' || initializeEmptyProductionCuid2,
  })
  const payload = await getPayload({config, disableOnInit: true})
  await payload.db.migrate()
  if (prepared.migrationChain === 'cuid2') await assertMigrationTarget(cloudflare.env.D1, 'cuid2', { allowEmpty: false })
  else await assertLegacyMigrationTarget(cloudflare.env.D1)
  await payload.destroy()
  console.log(`${target} D1 migrations applied`)
} finally {
  prepared.cleanup()
  await disposeCloudflare(cloudflare)
}
