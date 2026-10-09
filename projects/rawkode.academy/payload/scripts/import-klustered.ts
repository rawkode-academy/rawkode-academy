import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { getPayload } from 'payload'
import { assertProductionImportAllowed, assertSequenceAdvances, gitSha, KLUSTERED_PRODUCTION_CONFIRMATION, gitTreeClean, parseImportTarget, positionalArguments, resolveSequence, storedMaxSequence, type Watermark } from './lib/import-target'
import { disposeCloudflare, prepareTarget, TargetError } from './lib/remote-target'

const argv = process.argv.slice(2)
const includeSensitive = argv.includes('--include-sensitive') || process.env.KLUSTERED_INCLUDE_SENSITIVE === 'true'
const dryRun = argv.includes('--dry-run')
const resume = argv.includes('--resume')
const projectDir = process.cwd()

let target: ReturnType<typeof parseImportTarget>
let inputPath: string
let input: unknown
let watermark: Watermark
try {
  target = parseImportTarget(argv)
  const candidate = positionalArguments(argv)[0] ?? process.env.KLUSTERED_SNAPSHOT_PATH
  if (!candidate) throw new TargetError('Provide a Klustered JSON export path or KLUSTERED_SNAPSHOT_PATH')
  inputPath = candidate
  input = JSON.parse(await readFile(inputPath, 'utf8'))
  const metadata = input && typeof input === 'object' && '__meta' in input && input.__meta && typeof input.__meta === 'object' ? input.__meta as { sequence?: number } : undefined
  const exported = Number(metadata?.sequence)
  watermark = { gitSha: gitSha(projectDir), ...resolveSequence(process.env.KLUSTERED_CONTENT_SEQUENCE, Number.isSafeInteger(exported) && exported > 0 ? { sequence: exported, source: 'snapshot' } : { sequence: 1, source: 'default' }) }
  assertProductionImportAllowed({
    target, argv, env: process.env, gitClean: target === 'production' ? gitTreeClean(projectDir) : true,
    includeSensitive, sequenceVariable: 'KLUSTERED_CONTENT_SEQUENCE (or the export __meta.sequence)', watermark,
    confirmation: KLUSTERED_PRODUCTION_CONFIRMATION,
  })
} catch (error) {
  if (!(error instanceof TargetError)) throw error
  console.error(error.message)
  process.exit(1)
}

const prepared = prepareTarget(target)
const { buildKlusteredSnapshot } = await import('../src/klustered-content')
const { cloudflare } = await import('../src/cloudflare')
const { default: config } = await import('../payload.config')
const { importCatalogue } = await import('../src/importer')

type ImportUser = NonNullable<Parameters<Awaited<ReturnType<typeof getPayload>>['find']>[0]['user']>
const user = { id: 'klustered-importer', collection: 'users', role: 'staff' } as ImportUser
const snapshot = buildKlusteredSnapshot(input as Parameters<typeof buildKlusteredSnapshot>[0], { includeSensitive, sequence: watermark.sequence })
const payload = await getPayload({ config, disableOnInit: true })

function redactLegacyId(collection: string, legacyId: string): string {
  return collection === 'team-invites' ? '[redacted]' : legacyId
}

function redactResult<T extends { collection: string; legacyId: string }>(value: T): T {
  return { ...value, legacyId: redactLegacyId(value.collection, value.legacyId) }
}

try {
  // Seasons relate to the Klustered show created by the static import. Without
  // it every season stays pending, so stop before writing anything.
  const show = await payload.find({ collection: 'shows', where: { legacyId: { equals: 'klustered' } }, limit: 1, depth: 0, draft: true, overrideAccess: false, user })
  if (!show.docs.length) throw new TargetError(`The ${target} target has no show with legacyId 'klustered'. Run the static import first.`)
  if (target !== 'local') {
    const collections = [...new Set(snapshot.records.map(record => record.collection))]
    assertSequenceAdvances(snapshot.sequence, await storedMaxSequence(payload, user, collections, snapshot.sourceSystem), { resume })
  }
  const result = await importCatalogue(payload, user, snapshot, { dryRun })
  const safeResult = includeSensitive ? {
    ...result,
    actions: result.actions.map(redactResult),
    conflicts: result.conflicts.map(redactResult),
    unresolved: result.unresolved.map(item => ({ ...item, legacyId: redactLegacyId(item.collection, item.legacyId), reference: { ...item.reference, legacyId: redactLegacyId(item.reference.collection, item.reference.legacyId) } })),
  } : result
  const report = { target, resources: prepared.expected ?? null, watermark, source: inputPath, includeSensitive, records: snapshot.records.length, ...safeResult }
  const reportPath = path.join(projectDir, '.runtime', `import-klustered-${target}-${watermark.gitSha.slice(0, 12)}${dryRun ? '-dry-run' : ''}.json`)
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  console.error(`Import report written to ${reportPath}`)
  if (result.conflicts.length || result.unresolved.length) process.exitCode = 2
} catch (error) {
  if (!(error instanceof TargetError)) throw error
  console.error(error.message)
  process.exitCode = 1
} finally {
  await payload.destroy()
  await disposeCloudflare(cloudflare)
  prepared.cleanup()
}
