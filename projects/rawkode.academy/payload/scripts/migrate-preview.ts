import { getPayload } from 'payload'
import { disposeCloudflare, prepareTarget } from './lib/remote-target'

// prepareTarget writes an explicit remote-only Wrangler config without a
// `previews` block and asserts the resolved D1/R2 IDs before anything connects.
// It must run before src/cloudflare is imported, because that module creates
// the Cloudflare platform proxy at import time.
const prepared = prepareTarget('preview')
const { cloudflare } = await import('../src/cloudflare')

try {
  const {default: config} = await import('../payload.config')
  const payload = await getPayload({config, disableOnInit: true})
  await payload.db.migrate()
  await payload.destroy()
  console.log('Preview D1 migrations applied')
} finally {
  prepared.cleanup()
  await disposeCloudflare(cloudflare)
}
