import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { getPayload } from 'payload'
import { assertProductionImportAllowed, assertSequenceAdvances, gitCommitWatermark, gitSha, gitTreeClean, parseImportTarget, resolveSequence, storedMaxSequence, type Watermark } from './lib/import-target'
import { disposeCloudflare, prepareTarget, TargetError } from './lib/remote-target'
import { assertCuid2DocumentSchema } from '../src/id-schema'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const resume = argv.includes('--resume')
const projectDir = process.cwd()
const defaultContentRoot = path.resolve(projectDir, '../../../content')
const contentRoot = path.resolve(projectDir, process.env.STATIC_CONTENT_ROOT ?? defaultContentRoot)

let target: ReturnType<typeof parseImportTarget>
let watermark: Watermark
try {
  target = parseImportTarget(argv)
  // The watermark is the newest commit that can change the mapped output: the
  // content itself or the mapping code.
  const sourceWatermark = gitCommitWatermark(projectDir, [contentRoot, path.join(projectDir, 'src/static-content.ts')])
  watermark = { gitSha: gitSha(projectDir), ...resolveSequence(process.env.STATIC_CONTENT_SEQUENCE, sourceWatermark ? { sequence: sourceWatermark, source: 'git' } : { sequence: 1, source: 'default' }) }
  if (target === 'production' && contentRoot !== defaultContentRoot) throw new TargetError('Refusing the production import: STATIC_CONTENT_ROOT must not override the repository content/ directory.')
  assertProductionImportAllowed({
    target, argv, env: process.env, gitClean: target === 'production' ? gitTreeClean(projectDir) : true,
    sequenceVariable: 'STATIC_CONTENT_SEQUENCE', watermark, minimumSequence: sourceWatermark || undefined,
  })
} catch (error) {
  if (!(error instanceof TargetError)) throw error
  console.error(error.message)
  process.exit(1)
}

const prepared = prepareTarget(target)
const { buildStaticSnapshot, staticContentCollections } = await import('../src/static-content')
const { cloudflare } = await import('../src/cloudflare')
const { default: config } = await import('../payload.config')
const { importCatalogue } = await import('../src/importer')
const { precomputeD2Artifacts } = await import('./lib/d2-static')

type ImportUser = NonNullable<Parameters<Awaited<ReturnType<typeof getPayload>>['find']>[0]['user']>
const user = { id: 'static-content-importer', collection: 'users', role: 'staff' } as ImportUser
const snapshot = await buildStaticSnapshot({ root: contentRoot, sequence: watermark.sequence })
const payload = await getPayload({ config, disableOnInit: true })

try {
  await assertCuid2DocumentSchema(cloudflare.env.D1)
  if (target !== 'local') {
    const collections = [...new Set([...staticContentCollections, ...snapshot.records.map(record => record.collection)])]
    assertSequenceAdvances(snapshot.sequence, await storedMaxSequence(payload, user, collections, snapshot.sourceSystem), { resume })
  }
  // Upload immutable assets before publishing metadata. A failed asset upload
  // can leave orphaned content-addressed objects, but cannot leave a published
  // record pointing at an object that was never written.
  const startedAt = Date.now()
  const assets = { uploaded: 0, skipped: 0 }
  if (!dryRun) {
    for (const asset of snapshot.assetFiles) {
      const existing = await cloudflare.env.R2.head(asset.r2Key)
      if (existing && existing.size === asset.bytes && existing.customMetadata?.checksum === asset.checksum) {
        assets.skipped += 1
        continue
      }
      const bytes = await readFile(asset.absolutePath)
      await cloudflare.env.R2.put(asset.r2Key, bytes, {
        httpMetadata: { contentType: asset.mimeType },
        customMetadata: { checksum: asset.checksum, sourcePath: asset.relativePath },
      })
      assets.uploaded += 1
    }
  }
  let diagrams = 0
  if (!dryRun) {
    for (const record of snapshot.records) diagrams += await precomputeD2Artifacts(record.source?.body ?? String(record.data.body ?? ''), cloudflare.env.R2)
  }
  const result = await importCatalogue(payload, user, snapshot, { dryRun })
  const report = { target, resources: prepared.expected ?? null, watermark, source: contentRoot, records: snapshot.records.length, assetFiles: snapshot.assetFiles.length, assets, diagrams, elapsedMs: Date.now() - startedAt, ...result }
  const reportPath = path.join(projectDir, '.runtime', `import-${target}-${watermark.gitSha.slice(0, 12)}${dryRun ? '-dry-run' : ''}.json`)
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  console.error(`Import report written to ${reportPath}`)
  if (result.conflicts.length || result.unresolved.length) process.exitCode = 2
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
} finally {
  try { await payload.destroy() } catch (error) {
    console.error('Payload cleanup failed', error)
    process.exitCode = 1
  }
  try { await disposeCloudflare(cloudflare) } catch (error) {
    console.error('Cloudflare cleanup failed', error)
    process.exitCode = 1
  }
  try { prepared.cleanup() } catch (error) {
    console.error('Import target cleanup failed', error)
    process.exitCode = 1
  }
}

// @terrastruct/d2@0.1.33 has no supported dispose/terminate API and owns a
// worker thread. This standalone CLI exits only after report writing and every
// awaited Payload, Cloudflare and temporary-target cleanup has completed.
process.exit(process.exitCode ?? 0)
