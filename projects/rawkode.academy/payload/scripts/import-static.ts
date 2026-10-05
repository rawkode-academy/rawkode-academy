import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { getPayload } from 'payload'

const args = new Set(process.argv.slice(2))
const remote = args.has('--remote')
const dryRun = args.has('--dry-run')
const projectDir = process.cwd()
const contentRoot = path.resolve(projectDir, process.env.STATIC_CONTENT_ROOT ?? '../../../content')

process.env.POC_CLI = '1'
if (remote) process.env.POC_REMOTE_BINDINGS = '1'

const { buildStaticSnapshot } = await import('../src/static-content')
const { cloudflare } = await import('../src/cloudflare')
const { default: config } = await import('../payload.config')
const { importCatalogue } = await import('../src/importer')

type ImportUser = NonNullable<Parameters<Awaited<ReturnType<typeof getPayload>>['find']>[0]['user']>
const user = { id: 'static-content-importer', collection: 'users', role: 'staff' } as ImportUser
const snapshot = await buildStaticSnapshot({ root: contentRoot })
const payload = await getPayload({ config, disableOnInit: true })

try {
  // Upload immutable assets before publishing metadata. A failed asset upload
  // can leave orphaned content-addressed objects, but cannot leave a published
  // record pointing at an object that was never written.
  if (!dryRun) {
    for (const asset of snapshot.assetFiles) {
      const bytes = await readFile(asset.absolutePath)
      await cloudflare.env.R2.put(asset.r2Key, bytes, {
        httpMetadata: { contentType: asset.mimeType },
        customMetadata: { checksum: asset.checksum, sourcePath: asset.relativePath },
      })
    }
  }
  const result = await importCatalogue(payload, user, snapshot, { dryRun })
  console.log(JSON.stringify({ source: contentRoot, records: snapshot.records.length, assets: snapshot.assetFiles.length, ...result }, null, 2))
  if (result.conflicts.length || result.unresolved.length) process.exitCode = 2
} finally {
  await payload.destroy()
  if ('dispose' in cloudflare && typeof cloudflare.dispose === 'function') await cloudflare.dispose()
}
