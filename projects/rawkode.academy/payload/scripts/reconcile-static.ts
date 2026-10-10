import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { getPayload, type CollectionSlug } from 'payload'
import { gitCommitWatermark, gitSha, parseImportTarget, resolveSequence } from './lib/import-target'
import { actualFromDocuments, expectedFromSnapshot, reconcile, renderMarkdown, type ActualObject } from './lib/reconcile'
import { disposeCloudflare, prepareTarget, TargetError } from './lib/remote-target'
import { assertCuid2DocumentSchema } from '../src/id-schema'

// Read-only: compares the content/ snapshot at this checkout with what an
// import left in the target, and exits 1 on any difference.
const argv = process.argv.slice(2)
const projectDir = process.cwd()
const contentRoot = path.resolve(projectDir, process.env.STATIC_CONTENT_ROOT ?? '../../../content')

let target: ReturnType<typeof parseImportTarget>
let sha: string
let sequence: number
let sequenceSource: string
try {
  target = parseImportTarget(argv)
  sha = gitSha(projectDir)
  const sourceWatermark = gitCommitWatermark(projectDir, [contentRoot, path.join(projectDir, 'src/static-content.ts')])
  const resolved = resolveSequence(process.env.STATIC_CONTENT_SEQUENCE, sourceWatermark ? { sequence: sourceWatermark, source: 'git' } : { sequence: 1, source: 'default' })
  // A production import refuses a derived watermark, so a derived one here
  // would compare against a sequence the import never wrote.
  if (target === 'production' && resolved.sequenceSource !== 'env') throw new TargetError('Set STATIC_CONTENT_SEQUENCE to the watermark the production import recorded (see .runtime/import-production-<sha>.json).')
  sequence = resolved.sequence
  sequenceSource = resolved.sequenceSource === 'env' ? 'STATIC_CONTENT_SEQUENCE' : resolved.sequenceSource === 'git' ? 'git commit time' : 'default'
} catch (error) {
  if (!(error instanceof TargetError)) throw error
  console.error(error.message)
  process.exit(1)
}
const strictOrphans = !argv.includes('--allow-orphans')
const outFlag = argv.find(argument => argument.startsWith('--out='))?.slice('--out='.length)
const outDir = path.resolve(projectDir, outFlag ?? (target === 'local' ? '.runtime/reconciliation' : 'evidence/reconciliation'))

const prepared = prepareTarget(target)
const { buildStaticSnapshot, staticContentCollections } = await import('../src/static-content')
const { cloudflare } = await import('../src/cloudflare')
await assertCuid2DocumentSchema(cloudflare.env.D1)
const { default: config } = await import('../payload.config')

type ReadUser = NonNullable<Parameters<Awaited<ReturnType<typeof getPayload>>['find']>[0]['user']>
const user = { id: 'static-content-reconciler', collection: 'users', role: 'staff' } as ReadUser
const snapshot = await buildStaticSnapshot({ root: contentRoot, sequence })
const payload = await getPayload({ config, disableOnInit: true })

try {
  const expected = await expectedFromSnapshot(snapshot)
  const collections = [...new Set([...staticContentCollections, ...snapshot.records.map(record => record.collection)])].sort()
  const documents: Record<string, (Record<string, unknown> & { id: string | number })[]> = {}
  for (const collection of collections) {
    documents[collection] = []
    for (let page = 1; ; page += 1) {
      const found = await payload.find({ collection: collection as CollectionSlug, depth: 0, draft: true, limit: 500, page, sort: 'id', overrideAccess: false, user })
      documents[collection].push(...found.docs as unknown as (Record<string, unknown> & { id: string | number })[])
      if (!found.hasNextPage) break
    }
  }
  const objects: ActualObject[] = []
  let cursor: string | undefined
  do {
    const listed = await cloudflare.env.R2.list({ prefix: 'static/', cursor, include: ['customMetadata'] })
    for (const object of listed.objects) objects.push({ key: object.key, size: object.size, checksum: object.customMetadata?.checksum ?? null })
    cursor = listed.truncated ? listed.cursor : undefined
  } while (cursor)

  const report = reconcile({
    target, gitSha: sha, sequence: snapshot.sequence, mappingVersion: snapshot.mappingVersion, sourceSystem: snapshot.sourceSystem,
    expected, actual: { records: actualFromDocuments(documents), objects }, strictOrphans, sequenceSource,
  })
  const basename = `${target}-${sha.slice(0, 12)}`
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, `${basename}.json`), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(path.join(outDir, `${basename}.md`), renderMarkdown(report))
  console.log(JSON.stringify({ target, ok: report.ok, diffs: report.diffs.length, diffCounts: report.diffCounts, collections: report.collections, assets: report.assets }, null, 2))
  console.error(`Reconciliation report written to ${path.join(outDir, basename)}.{json,md}`)
  if (!report.ok) process.exitCode = 1
} finally {
  await payload.destroy()
  await disposeCloudflare(cloudflare)
  prepared.cleanup()
}
