import { relations, sourceHash } from '../../src/importer'
import type { ImportRecord, ImportSnapshot, SourceAsset } from '../../src/import-types'

/** Relationship edges as ordered `collection:legacyId` keys, per field. */
export type Edges = Record<string, string[]>
export type ExpectedRecord = {
  collection: string
  legacyId: string
  slug: string
  sourceRevision: string
  sourceHash: string
  status: 'draft' | 'published'
  tombstone: boolean
  edges: Edges
}
export type ActualRecord = {
  collection: string
  legacyId: string
  slug: string | null
  sourceSystem: string | null
  sourceRevision: string | null
  sourceHash: string | null
  sourceSequence: number | null
  importState: string | null
  locallyEdited: boolean
  tombstone: boolean
  status: string | null
  edges: Edges
}
export type ExpectedAsset = Pick<SourceAsset, 'r2Key' | 'checksum' | 'bytes' | 'relativePath'>
export type ActualObject = { key: string; size: number; checksum: string | null }

export type DiffKind =
  | 'missing' | 'extra' | 'duplicate' | 'slug' | 'sourceRevision' | 'sourceHash' | 'sourceSequence' | 'importState' | 'locallyEdited' | 'tombstone' | 'status' | 'edges'
  | 'asset-missing' | 'asset-size' | 'asset-checksum' | 'orphan-object'
export type Diff = { kind: DiffKind; collection?: string; legacyId?: string; field?: string; key?: string; expected?: unknown; actual?: unknown }

export type ReconcileInput = {
  target: string
  gitSha: string
  sequence: number
  mappingVersion: string
  sourceSystem: string
  expected: { records: ExpectedRecord[]; assets: ExpectedAsset[] }
  actual: { records: ActualRecord[]; objects: ActualObject[] }
  /** R2 key prefix owned by the static import; objects under it with no record are orphans. */
  assetPrefix?: string
  /** Collections with `versions.drafts: false` have no `_status` to compare. */
  collectionsWithoutDrafts?: readonly string[]
  /**
   * Orphaned objects fail the report by default. Asset keys are
   * content-addressed and imports never delete, so a re-import after a changed
   * or removed asset leaves its old object behind; only then may an operator
   * pass false to list them without failing.
   */
  strictOrphans?: boolean
  /** Where the compared watermark came from, for the report header. */
  sequenceSource?: string
  generatedAt?: string
}
export type ReconcileReport = {
  target: string
  gitSha: string
  sequence: number
  sequenceSource: string | null
  mappingVersion: string
  sourceSystem: string
  generatedAt: string
  ok: boolean
  strictOrphans: boolean
  collections: Record<string, { expected: number; actual: number }>
  assets: { expected: number; actual: number; orphans: number }
  diffCounts: Partial<Record<DiffKind, number>>
  diffs: Diff[]
  orphanObjects: ActualObject[]
}

function refKey(collection: string, legacyId: string): string {
  return `${collection}:${legacyId}`
}

function edgesFor(record: ImportRecord): Edges {
  const edges: Edges = {}
  if (record.tombstone) return edges
  for (const [field, value] of Object.entries(record.relationships ?? {})) {
    edges[field] = (value === null ? [] : Array.isArray(value) ? value : [value]).map(ref => refKey(ref.collection, ref.legacyId))
  }
  return edges
}

/** The state a complete import of this snapshot must leave in the target. */
export async function expectedFromSnapshot(snapshot: ImportSnapshot & { assetFiles?: ExpectedAsset[] }): Promise<{ records: ExpectedRecord[]; assets: ExpectedAsset[] }> {
  const records: ExpectedRecord[] = []
  for (const record of snapshot.records) {
    records.push({
      collection: record.collection,
      legacyId: record.legacyId,
      slug: record.slug,
      sourceRevision: record.sourceRevision,
      sourceHash: await sourceHash(record, snapshot.mappingVersion),
      status: record.tombstone ? 'draft' : record.status ?? 'draft',
      tombstone: record.tombstone ?? false,
      edges: edgesFor(record),
    })
  }
  const assets = (snapshot.assetFiles ?? []).map(({ r2Key, checksum, bytes, relativePath }) => ({ r2Key, checksum, bytes, relativePath }))
  return { records, assets }
}

type Document = Record<string, unknown> & { id: string | number }

function relationshipId(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in value) return relationshipId((value as { id: unknown }).id)
  return null
}

/**
 * Normalise Payload documents (depth 0) into comparable records. Relationship
 * IDs are environment-specific, so every edge is rewritten to the target's
 * legacy ID before comparison.
 */
export function actualFromDocuments(documents: Record<string, Document[]>): ActualRecord[] {
  const legacyIds = new Map<string, string>()
  for (const [collection, docs] of Object.entries(documents)) {
    for (const doc of docs) legacyIds.set(`${collection}#${String(doc.id)}`, String(doc.legacyId ?? `#${String(doc.id)}`))
  }
  const records: ActualRecord[] = []
  for (const [collection, docs] of Object.entries(documents)) {
    const rules = relations[collection as keyof typeof relations] ?? {}
    for (const doc of docs) {
      const edges: Edges = {}
      for (const [field, rule] of Object.entries(rules)) {
        const raw = doc[field]
        const values = Array.isArray(raw) ? raw : raw === null || raw === undefined ? [] : [raw]
        const keys = values.map(relationshipId).filter((id): id is string | number => id !== null).map(id => refKey(rule.collection, legacyIds.get(`${rule.collection}#${String(id)}`) ?? `#${String(id)}`))
        if (keys.length || field in doc) edges[field] = keys
      }
      const sequence = Number(doc.sourceSequence)
      records.push({
        collection,
        legacyId: String(doc.legacyId ?? `#${String(doc.id)}`),
        slug: typeof doc.slug === 'string' ? doc.slug : null,
        sourceSystem: typeof doc.sourceSystem === 'string' ? doc.sourceSystem : null,
        sourceRevision: typeof doc.sourceRevision === 'string' ? doc.sourceRevision : null,
        sourceHash: typeof doc.sourceHash === 'string' ? doc.sourceHash : null,
        sourceSequence: doc.sourceSequence === null || doc.sourceSequence === undefined || !Number.isFinite(sequence) ? null : sequence,
        importState: typeof doc.importState === 'string' ? doc.importState : null,
        locallyEdited: doc.locallyEdited === true,
        tombstone: doc.tombstone === true,
        status: typeof doc._status === 'string' ? doc._status : null,
        edges,
      })
    }
  }
  return records
}

function sameList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/** Compare a snapshot's expected state to a target. Pure, so it is unit-testable without D1 or R2. */
export function reconcile(input: ReconcileInput): ReconcileReport {
  const diffs: Diff[] = []
  const collections: Record<string, { expected: number; actual: number }> = {}
  const count = (collection: string, side: 'expected' | 'actual') => {
    collections[collection] ??= { expected: 0, actual: 0 }
    collections[collection][side] += 1
  }
  const actualByKey = new Map<string, ActualRecord>()
  for (const record of input.actual.records) {
    count(record.collection, 'actual')
    const key = refKey(record.collection, record.legacyId)
    if (actualByKey.has(key)) diffs.push({ kind: 'duplicate', collection: record.collection, legacyId: record.legacyId })
    else actualByKey.set(key, record)
  }
  const expectedKeys = new Set<string>()
  const withoutDrafts = new Set(input.collectionsWithoutDrafts ?? ['static-assets'])
  for (const expected of input.expected.records) {
    count(expected.collection, 'expected')
    const key = refKey(expected.collection, expected.legacyId)
    expectedKeys.add(key)
    const actual = actualByKey.get(key)
    const at = { collection: expected.collection, legacyId: expected.legacyId }
    if (!actual) {
      diffs.push({ kind: 'missing', ...at })
      continue
    }
    const scalar = (kind: DiffKind, expectedValue: unknown, actualValue: unknown) => {
      if (expectedValue !== actualValue) diffs.push({ kind, ...at, expected: expectedValue, actual: actualValue })
    }
    scalar('slug', expected.slug, actual.slug)
    scalar('sourceRevision', expected.sourceRevision, actual.sourceRevision)
    scalar('sourceHash', expected.sourceHash, actual.sourceHash)
    scalar('sourceSequence', input.sequence, actual.sourceSequence)
    scalar('importState', 'complete', actual.importState)
    scalar('locallyEdited', false, actual.locallyEdited)
    scalar('tombstone', expected.tombstone, actual.tombstone)
    if (!withoutDrafts.has(expected.collection)) scalar('status', expected.status, actual.status)
    for (const field of [...new Set([...Object.keys(expected.edges), ...Object.keys(actual.edges)])].sort()) {
      const want = expected.edges[field] ?? []
      const have = actual.edges[field] ?? []
      if (!sameList(want, have)) diffs.push({ kind: 'edges', ...at, field, expected: want, actual: have })
    }
  }
  for (const [key, actual] of actualByKey) {
    if (!expectedKeys.has(key)) diffs.push({ kind: 'extra', collection: actual.collection, legacyId: actual.legacyId, actual: { sourceSystem: actual.sourceSystem, status: actual.status } })
  }

  const prefix = input.assetPrefix ?? 'static/'
  const objects = new Map(input.actual.objects.map(object => [object.key, object]))
  const expectedObjectKeys = new Set<string>()
  for (const asset of input.expected.assets) {
    expectedObjectKeys.add(asset.r2Key)
    const object = objects.get(asset.r2Key)
    if (!object) {
      diffs.push({ kind: 'asset-missing', key: asset.r2Key, expected: { bytes: asset.bytes, checksum: asset.checksum } })
      continue
    }
    if (object.size !== asset.bytes) diffs.push({ kind: 'asset-size', key: asset.r2Key, expected: asset.bytes, actual: object.size })
    if (object.checksum !== asset.checksum) diffs.push({ kind: 'asset-checksum', key: asset.r2Key, expected: asset.checksum, actual: object.checksum })
  }
  const strictOrphans = input.strictOrphans ?? true
  const orphanObjects: ActualObject[] = []
  for (const object of input.actual.objects) {
    if (!object.key.startsWith(prefix) || expectedObjectKeys.has(object.key)) continue
    orphanObjects.push(object)
    if (strictOrphans) diffs.push({ kind: 'orphan-object', key: object.key, actual: { size: object.size, checksum: object.checksum } })
  }

  const diffCounts: Partial<Record<DiffKind, number>> = {}
  for (const diff of diffs) diffCounts[diff.kind] = (diffCounts[diff.kind] ?? 0) + 1
  const sortedCollections = Object.fromEntries(Object.entries(collections).sort(([left], [right]) => left.localeCompare(right)))
  return {
    target: input.target,
    gitSha: input.gitSha,
    sequence: input.sequence,
    sequenceSource: input.sequenceSource ?? null,
    mappingVersion: input.mappingVersion,
    sourceSystem: input.sourceSystem,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    ok: diffs.length === 0,
    strictOrphans,
    collections: sortedCollections,
    assets: { expected: input.expected.assets.length, actual: input.actual.objects.filter(object => object.key.startsWith(prefix)).length, orphans: orphanObjects.length },
    diffCounts,
    diffs,
    orphanObjects,
  }
}

function cell(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return (text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export function renderMarkdown(report: ReconcileReport, options: { maxDiffs?: number } = {}): string {
  const maxDiffs = options.maxDiffs ?? 200
  const lines = [
    `# Static content reconciliation: ${report.target}`,
    '',
    `- Result: ${report.ok ? 'PASS, 0 diffs' : `FAIL, ${report.diffs.length} diffs`}`,
    `- Git SHA: \`${report.gitSha}\``,
    `- Sequence (watermark): ${report.sequence}${report.sequenceSource ? ` (from ${report.sequenceSource})` : ''}`,
    `- Mapping version: ${report.mappingVersion}`,
    `- Source system: ${report.sourceSystem}`,
    `- Generated: ${report.generatedAt}`,
    '',
    '## Records per collection',
    '',
    '| Collection | Expected | Actual |',
    '| --- | ---: | ---: |',
    ...Object.entries(report.collections).map(([collection, counts]) => `| ${collection} | ${counts.expected} | ${counts.actual} |`),
    '',
    '## R2 static assets',
    '',
    `Expected ${report.assets.expected}, found ${report.assets.actual} under the static prefix, ${report.assets.orphans} orphaned.`,
    '',
  ]
  if (report.orphanObjects.length && !report.strictOrphans) {
    lines.push(
      '## Orphaned objects (not failing)',
      '',
      'Asset keys are content-addressed and imports never delete, so a changed or removed asset leaves its previous object here. This run passed `--allow-orphans`, so they do not fail it.',
      '',
      '| Key | Size | Checksum |',
      '| --- | ---: | --- |',
      ...report.orphanObjects.slice(0, maxDiffs).map(object => `| ${cell(object.key)} | ${object.size} | ${cell(object.checksum ?? '')} |`),
      '',
    )
    if (report.orphanObjects.length > maxDiffs) lines.push(`${report.orphanObjects.length - maxDiffs} more orphaned objects are listed in the JSON report.`, '')
  }
  if (report.ok) return `${lines.join('\n')}\n`
  lines.push('## Diffs by kind', '', '| Kind | Count |', '| --- | ---: |', ...Object.entries(report.diffCounts).map(([kind, total]) => `| ${kind} | ${total} |`), '')
  lines.push('## Diffs', '', '| Kind | Record or key | Field | Expected | Actual |', '| --- | --- | --- | --- | --- |')
  for (const diff of report.diffs.slice(0, maxDiffs)) {
    const subject = diff.key ?? `${diff.collection}:${diff.legacyId}`
    lines.push(`| ${diff.kind} | ${cell(subject)} | ${cell(diff.field ?? '')} | ${cell(diff.expected ?? '')} | ${cell(diff.actual ?? '')} |`)
  }
  if (report.diffs.length > maxDiffs) lines.push('', `${report.diffs.length - maxDiffs} more diffs are listed in the JSON report.`)
  return `${lines.join('\n')}\n`
}
