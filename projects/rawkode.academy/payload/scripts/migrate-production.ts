import { getPayload } from 'payload'
import { parseImportTarget } from './lib/import-target'
import { disposeCloudflare, prepareTarget, TargetError } from './lib/remote-target'

// Applies Payload migrations to one target. Without --target it migrates
// production, which is what deploy.migrate relies on. --target=rehearsal
// prepares a fresh disposable rehearsal D1 before import.rehearsal.
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

const prepared = prepareTarget(target)
const { cloudflare } = await import('../src/cloudflare')

try {
  const {default: config} = await import('../payload.config')
  const payload = await getPayload({config, disableOnInit: true})
  await payload.db.migrate()
  await payload.destroy()
  console.log(`${target} D1 migrations applied`)
} finally {
  prepared.cleanup()
  await disposeCloudflare(cloudflare)
}
