import { readFile } from 'node:fs/promises'
import { getPayload } from 'payload'

const args = process.argv.slice(2)
const inputPath = args.find(argument => !argument.startsWith('--')) ?? process.env.KLUSTERED_SNAPSHOT_PATH
if (!inputPath) throw new Error('Provide a Klustered JSON export path or KLUSTERED_SNAPSHOT_PATH')
const includeSensitive = args.includes('--include-sensitive') || process.env.KLUSTERED_INCLUDE_SENSITIVE === 'true'
const dryRun = args.includes('--dry-run')

process.env.POC_CLI = '1'
if (args.includes('--remote')) process.env.POC_REMOTE_BINDINGS = '1'

const { buildKlusteredSnapshot } = await import('../src/klustered-content')
const { cloudflare } = await import('../src/cloudflare')
const { default: config } = await import('../payload.config')
const { importCatalogue } = await import('../src/importer')

type ImportUser = NonNullable<Parameters<Awaited<ReturnType<typeof getPayload>>['find']>[0]['user']>
const user = { id: 'klustered-importer', collection: 'users', role: 'staff' } as ImportUser
const input = JSON.parse(await readFile(inputPath, 'utf8'))
const metadata = input && typeof input === 'object' && input.__meta && typeof input.__meta === 'object' ? input.__meta as { sequence?: number } : undefined
const snapshot = buildKlusteredSnapshot(input, { includeSensitive, sequence: metadata?.sequence })
const payload = await getPayload({ config, disableOnInit: true })

function redactLegacyId(collection: string, legacyId: string): string {
  return collection === 'team-invites' ? '[redacted]' : legacyId
}

function redactResult<T extends { collection: string; legacyId: string }>(value: T): T {
  return { ...value, legacyId: redactLegacyId(value.collection, value.legacyId) }
}

try {
  const result = await importCatalogue(payload, user, snapshot, { dryRun })
  const safeResult = includeSensitive ? {
    ...result,
    actions: result.actions.map(redactResult),
    conflicts: result.conflicts.map(redactResult),
    unresolved: result.unresolved.map(item => ({ ...item, legacyId: redactLegacyId(item.collection, item.legacyId), reference: { ...item.reference, legacyId: redactLegacyId(item.reference.collection, item.reference.legacyId) } })),
  } : result
  console.log(JSON.stringify({ source: inputPath, includeSensitive, records: snapshot.records.length, ...safeResult }, null, 2))
  if (result.conflicts.length || result.unresolved.length) process.exitCode = 2
} finally {
  await payload.destroy()
  if ('dispose' in cloudflare && typeof cloudflare.dispose === 'function') await cloudflare.dispose()
}
