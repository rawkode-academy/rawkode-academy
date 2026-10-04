import type { CollectionSlug, Payload } from 'payload'
import type { CatalogueCollection } from './catalogue'

export type Reference = { collection: CatalogueCollection; legacyId: string }
export type CatalogueRecord = {
  collection: CatalogueCollection
  legacyId: string
  legacyType: string
  slug: string
  sourceRevision: string
  status?: 'draft' | 'published'
  tombstone?: boolean
  data: Record<string, unknown>
  relationships?: Record<string, Reference | Reference[] | null>
}
export type CatalogueSnapshot = {
  sourceSystem: string
  mappingVersion: string
  sequence: number
  records: CatalogueRecord[]
}
type Document = Record<string, unknown> & { id: string | number; legacyId: string }
type Action = { collection: CatalogueCollection; legacyId: string; action: 'create' | 'update' | 'unchanged' | 'tombstone' | 'conflict' | 'pending' }
export type ImportResult = {
  dryRun: boolean
  counts: { created: number; updated: number; unchanged: number; tombstoned: number; conflicts: number; pending: number }
  actions: Action[]
  conflicts: { collection: CatalogueCollection; legacyId: string; reason: string }[]
  unresolved: { collection: CatalogueCollection; legacyId: string; field: string; reference: Reference }[]
}

const collections = new Set<CatalogueCollection>(['videos', 'articles', 'courses', 'course-modules', 'learning-paths', 'shows', 'episodes', 'technologies', 'people', 'chapters', 'learning-resources'])
const relations: Partial<Record<CatalogueCollection, Record<string, { collection: CatalogueCollection; many: boolean }>>> = {
  videos: { technologies: { collection: 'technologies', many: true }, guests: { collection: 'people', many: true }, episode: { collection: 'episodes', many: false }, chapters: { collection: 'chapters', many: true } },
  shows: { hosts: { collection: 'people', many: true }, episodes: { collection: 'episodes', many: true } },
  episodes: { video: { collection: 'videos', many: false }, show: { collection: 'shows', many: false } },
  technologies: { learningResources: { collection: 'learning-resources', many: false } },
  courses: { modules: { collection: 'course-modules', many: true }, authors: { collection: 'people', many: true }, technologies: { collection: 'technologies', many: true } },
  'course-modules': { course: { collection: 'courses', many: false }, video: { collection: 'videos', many: false }, resources: { collection: 'learning-resources', many: true } },
  articles: { authors: { collection: 'people', many: true }, technologies: { collection: 'technologies', many: true }, resources: { collection: 'learning-resources', many: true } },
  'learning-paths': { courses: { collection: 'courses', many: true }, videos: { collection: 'videos', many: true }, technologies: { collection: 'technologies', many: true } },
}
const reserved = new Set(['id', 'legacyId', 'legacyType', 'slug', 'sourceSystem', 'sourceRevision', 'sourceHash', 'sourceSequence', 'sourceFields', 'mappingVersion', 'importedAt', 'locallyEdited', 'importState', 'tombstone', '_status', 'createdAt', 'updatedAt'])

function key(reference: Reference): string { return `${reference.collection}:${reference.legacyId}` }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([name, child]) => `${JSON.stringify(name)}:${canonical(child)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
export async function sourceHash(record: CatalogueRecord, mappingVersion: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical({ mappingVersion, record })))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Validate the whole input before writing a node. IDs and relationship order are source-owned. */
function validate(snapshot: CatalogueSnapshot): void {
  if (!snapshot?.sourceSystem || !snapshot.mappingVersion || !Array.isArray(snapshot.records)) throw new Error('Expected sourceSystem, mappingVersion and records')
  if (!Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 1) throw new Error('Snapshot sequence must be a positive safe integer')
  const seen = new Set<string>()
  for (const record of snapshot.records) {
    if (!collections.has(record.collection) || !record.legacyId || !record.legacyType || !record.slug || !record.sourceRevision || !record.data || typeof record.data !== 'object') throw new Error('Invalid catalogue record')
    if (record.status && !['draft', 'published'].includes(record.status)) throw new Error(`Invalid status for ${key(record)}`)
    if (seen.has(key(record))) throw new Error(`Duplicate source ID: ${key(record)}`)
    seen.add(key(record))
    for (const field of Object.keys(record.data)) {
      if (reserved.has(field) || relations[record.collection]?.[field]) throw new Error(`Protected or relationship field in data: ${key(record)}.${field}`)
    }
    for (const [field, value] of Object.entries(record.relationships ?? {})) {
      const rule = relations[record.collection]?.[field]
      if (!rule || (value !== null && Array.isArray(value) !== rule.many)) throw new Error(`Invalid relationship shape: ${key(record)}.${field}`)
      for (const ref of value === null ? [] : Array.isArray(value) ? value : [value]) {
        if (!ref || ref.collection !== rule.collection || !ref.legacyId) throw new Error(`Invalid reference: ${key(record)}.${field}`)
      }
    }
  }
}

/** Server-only trusted entrypoint. The HTTP route authenticates an administrator first.
 * D1 does not give this importer an atomic compare-and-swap across editorial writes:
 * use an exclusive import window, and never run multiple imports concurrently.
 */
export async function importCatalogue(payload: Payload, user: NonNullable<Parameters<Payload['find']>[0]['user']>, snapshot: CatalogueSnapshot, options: { dryRun?: boolean } = {}): Promise<ImportResult> {
  validate(snapshot)
  const result: ImportResult = { dryRun: options.dryRun ?? false, counts: { created: 0, updated: 0, unchanged: 0, tombstoned: 0, conflicts: 0, pending: 0 }, actions: [], conflicts: [], unresolved: [] }
  const documents = new Map<string, Document>()
  const pending: { record: CatalogueRecord; hash: string; created: boolean }[] = []
  const eligibleSourceNodes = new Set<string>()
  const sourceRecords = new Map(snapshot.records.map(record => [key(record), record]))
  const lookup = async (ref: Reference): Promise<Document | undefined> => {
    const found = await payload.find({ collection: ref.collection as CollectionSlug, where: { legacyId: { equals: ref.legacyId } }, limit: 1, depth: 0, draft: true, overrideAccess: false, user })
    return found.docs[0] as unknown as Document | undefined
  }
  const conflict = (record: CatalogueRecord, reason: string): void => {
    result.counts.conflicts += 1
    result.conflicts.push({ collection: record.collection, legacyId: record.legacyId, reason })
    result.actions.push({ collection: record.collection, legacyId: record.legacyId, action: 'conflict' })
  }
  // Phase 1 creates stable nodes, durably marked pending. A failed run is resumed
  // by seeing pending even when the source hash already matches.
  for (const [index, input] of snapshot.records.entries()) {
    const record = { ...input, data: { sourceOrder: index, ...input.data } }
    const hash = await sourceHash(record, snapshot.mappingVersion)
    const markers = await payload.find({ collection: 'deletion-markers' as CollectionSlug, where: { key: { equals: key(record) } }, limit: 1, depth: 0, overrideAccess: false, user })
    if (markers.docs.length) {
      conflict(record, 'An editor deleted this legacy ID; explicit reconciliation is required before resurrection.')
      continue
    }
    const existing = await lookup(record)
    if (existing) documents.set(key(record), existing)
    if (existing?.locallyEdited || (existing && existing.sourceSystem !== snapshot.sourceSystem)) {
      conflict(record, existing.locallyEdited ? 'Local editorial changes require an explicit merge; no fields overwritten.' : 'Existing legacy ID belongs to another source.')
      continue
    }
    if (existing && (Number(existing.sourceSequence) > snapshot.sequence || (Number(existing.sourceSequence) === snapshot.sequence && existing.sourceHash !== hash))) {
      conflict(record, 'Stale or inconsistent snapshot sequence; changed source data requires a higher sequence.')
      continue
    }
    const sourceFields = [...Object.keys(record.data), ...Object.keys(record.relationships ?? {})].sort()
    if (existing && !record.tombstone && Array.isArray(existing.sourceFields) && existing.sourceFields.some(field => !sourceFields.includes(String(field)))) {
      conflict(record, 'Snapshot omitted a previously supplied field; use explicit null or [] to clear it.')
      continue
    }
    if (existing?.sourceHash === hash && existing.importState === 'complete' && Number(existing.sourceSequence) === snapshot.sequence) {
      result.counts.unchanged += 1
      result.actions.push({ collection: record.collection, legacyId: record.legacyId, action: 'unchanged' })
      continue
    }
    pending.push({ record, hash, created: !existing })
    eligibleSourceNodes.add(key(record))
    if (result.dryRun) continue
    const data = { ...record.data, legacyId: record.legacyId, legacyType: record.legacyType, slug: record.slug, sourceSystem: snapshot.sourceSystem, sourceRevision: record.sourceRevision, sourceHash: hash, sourceSequence: snapshot.sequence, sourceFields, mappingVersion: snapshot.mappingVersion, importedAt: new Date().toISOString(), locallyEdited: false, importState: 'pending', tombstone: record.tombstone ?? false, _status: 'draft' as const }
    const shared = { collection: record.collection as CollectionSlug, data, draft: true, depth: 0, overrideAccess: false, user, context: { importing: true } }
    const saved = existing ? await payload.update({ ...shared, id: existing.id }) : await payload.create(shared)
    documents.set(key(record), saved as unknown as Document)
  }
  // Propagate missing dependencies through the graph before publishing any pending node.
  // Valid cycles are allowed; one unresolved edge blocks its dependent source nodes.
  const blocked = new Set<string>()
  for (const {record} of pending) {
    for (const value of Object.values(record.tombstone ? {} : record.relationships ?? {})) {
      for (const ref of value === null ? [] : Array.isArray(value) ? value : [value]) {
        const target = documents.get(key(ref)) ?? await lookup(ref)
        if (target) documents.set(key(ref), target)
        if ((!target && !(result.dryRun && eligibleSourceNodes.has(key(ref)))) || target?.tombstone || sourceRecords.get(key(ref))?.tombstone || (target?.importState === 'pending' && !eligibleSourceNodes.has(key(ref)))) blocked.add(key(record))
      }
    }
  }
  let changed = true
  while (changed) {
    changed = false
    for (const {record} of pending) {
      if (blocked.has(key(record)) || record.tombstone) continue
      const references = Object.values(record.relationships ?? {}).flatMap(value => value === null ? [] : Array.isArray(value) ? value : [value])
      if (references.some(ref => blocked.has(key(ref)))) { blocked.add(key(record)); changed = true }
    }
  }
  // Phase 2 resolves relationships after all nodes exist. Cycles and source order
  // are preserved; unresolved nodes remain drafts and pending for the next run.
  for (const { record, hash, created } of pending) {
    const relationshipData: Record<string, unknown> = {}
    let unresolved = false
    for (const [field, value] of Object.entries(record.tombstone ? {} : record.relationships ?? {})) {
      const ids: (number | string)[] = []
      for (const ref of value === null ? [] : Array.isArray(value) ? value : [value]) {
        const target = documents.get(key(ref)) ?? await lookup(ref)
        const planned = sourceRecords.get(key(ref))
        if ((!target && !(result.dryRun && eligibleSourceNodes.has(key(ref)))) || target?.tombstone || planned?.tombstone || blocked.has(key(ref)) || (target?.importState === 'pending' && !eligibleSourceNodes.has(key(ref)))) {
          unresolved = true
          result.unresolved.push({ collection: record.collection, legacyId: record.legacyId, field, reference: ref })
        } else if (target) ids.push(target.id)
      }
      relationshipData[field] = Array.isArray(value) ? ids : ids[0] ?? null
    }
    if (unresolved) {
      result.counts.pending += 1
      result.actions.push({ collection: record.collection, legacyId: record.legacyId, action: 'pending' })
      continue
    }
    if (!result.dryRun) {
      const latest = await lookup(record)
      if (!latest || latest.locallyEdited) {
        conflict(record, 'Record changed during import; relationship/publication step refused.')
        continue
      }
      // Explicitly materialize the staged fields: publishing a relationship-only
      // patch must not depend on Payload merging the latest draft into the row.
      await payload.update({ collection: record.collection as CollectionSlug, id: latest.id, data: { ...record.data, ...relationshipData, legacyId: record.legacyId, legacyType: record.legacyType, slug: record.slug, sourceSystem: snapshot.sourceSystem, sourceRevision: record.sourceRevision, sourceHash: hash, sourceSequence: snapshot.sequence, sourceFields: [...Object.keys(record.data), ...Object.keys(record.relationships ?? {})].sort(), mappingVersion: snapshot.mappingVersion, importedAt: latest.importedAt, locallyEdited: false, tombstone: record.tombstone ?? false, importState: 'complete', _status: record.tombstone ? 'draft' : record.status ?? 'draft' }, draft: false, depth: 0, overrideAccess: false, user, context: { importing: true } })
    }
    const action = record.tombstone ? 'tombstone' : created ? 'create' : 'update'
    if (record.tombstone) result.counts.tombstoned += 1
    else if (created) result.counts.created += 1
    else result.counts.updated += 1
    result.actions.push({ collection: record.collection, legacyId: record.legacyId, action })
  }
  return result
}
