import type { CollectionSlug, Payload } from 'payload'

export type CatalogueDocument = Record<string, unknown> & { id: number | string; legacyId: string }
export type CatalogueCollection =
  | 'videos' | 'articles' | 'courses' | 'course-modules' | 'learning-paths' | 'shows' | 'episodes' | 'technologies' | 'people' | 'chapters' | 'learning-resources'
  | 'series' | 'adrs' | 'testimonials' | 'news' | 'changelog' | 'static-assets'
  | 'seasons' | 'competitors' | 'brackets' | 'bracket-applications' | 'teams' | 'team-members' | 'team-invites'
  | 'bracket-breaks' | 'bracket-entries' | 'matches' | 'match-results' | 'registrations'

/** A request-scoped, anonymous, published-only view; never share this cache across requests. */
export class Catalogue {
  private cache = new Map<CatalogueCollection, Promise<CatalogueDocument[]>>()
  constructor(private readonly payload: Payload) {}

  all(collection: CatalogueCollection): Promise<CatalogueDocument[]> {
    let cached = this.cache.get(collection)
    if (!cached) {
      cached = this.load(collection)
      this.cache.set(collection, cached)
    }
    return cached
  }

  private async load(collection: CatalogueCollection): Promise<CatalogueDocument[]> {
    const documents: CatalogueDocument[] = []
    let page = 1
    for (;;) {
      const result = await this.payload.find({
        collection: collection as CollectionSlug, overrideAccess: false,
        user: null, depth: 0, draft: false, limit: 100, page,
        where: { and: [{ _status: { equals: 'published' } }, { tombstone: { not_equals: true } }] },
        sort: 'legacyId',
      })
      documents.push(...result.docs as unknown as CatalogueDocument[])
      if (!result.hasNextPage) break
      page += 1
    }
    // sourceOrder is retained by import; stable legacy ID breaks ties for new records.
    return documents.sort((a, b) => Number(a.sourceOrder ?? Number.MAX_SAFE_INTEGER) - Number(b.sourceOrder ?? Number.MAX_SAFE_INTEGER) || a.legacyId.localeCompare(b.legacyId))
  }

  async byLegacyId(collection: CatalogueCollection, id: string): Promise<CatalogueDocument | null> {
    return (await this.all(collection)).find(document => document.legacyId === id) ?? null
  }

  async relationship(collection: CatalogueCollection, reference: unknown): Promise<CatalogueDocument | null> {
    const id = referenceId(reference)
    if (id === null) return null
    // Re-read through the public boundary even if a caller supplies a populated object.
    return (await this.all(collection)).find(document => String(document.id) === id) ?? null
  }

  async relationships(collection: CatalogueCollection, references: unknown): Promise<CatalogueDocument[]> {
    if (!Array.isArray(references)) return []
    const related = await Promise.all(references.map(reference => this.relationship(collection, reference)))
    return related.filter((document): document is CatalogueDocument => document !== null)
  }

  async reverse(collection: CatalogueCollection, field: string, document: CatalogueDocument): Promise<CatalogueDocument[]> {
    return (await this.all(collection)).filter(candidate => {
      const references = Array.isArray(candidate[field]) ? candidate[field] : [candidate[field]]
      return references.some(reference => referenceId(reference) === String(document.id))
    })
  }
}

export function referenceId(reference: unknown): string | null {
  if (typeof reference === 'string' || typeof reference === 'number') return String(reference)
  if (reference && typeof reference === 'object') {
    const value = reference as Record<string, unknown>
    return referenceId(value.id ?? value.value)
  }
  return null
}

export function stringRows(value: unknown): string[] | null {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value)) return null
  return value.map(row => typeof row === 'string' ? row : String(row.value ?? row.url ?? row.term ?? '')).filter(Boolean)
}
