import type { Payload } from 'payload'
import { isCuid2 } from './cuid2'

export const publicContentCollections = [
  'videos', 'articles', 'news', 'shows', 'episodes', 'people', 'technologies', 'series', 'courses', 'course-modules',
  'learning-paths', 'chapters', 'learning-resources', 'adrs', 'changelog', 'testimonials',
] as const
export type PublicContentCollection = typeof publicContentCollections[number]
type Doc = Record<string, unknown> & { id: string | number }
type Query = Record<string, unknown>
type PublicPayload = Pick<Payload, 'find'>

const collectionSet = new Set<string>(publicContentCollections)
const dateCollections = new Set<PublicContentCollection>(['videos', 'articles', 'news', 'courses', 'course-modules', 'learning-paths'])
const collectionFields: Record<PublicContentCollection, { summary: string[]; full: string[]; searchable: string[] }> = {
  videos: { summary: ['slug','title','tagline','subtitle','description','publishedAt','duration','type','category','thumbnailUrl','show','technologies','guests','episode','terms','cover'], full: ['whatYouWillLearn','streamUrl','youtubeId','podcast','subscribeLinks','chapters','audioFileSize','body','contentResources'], searchable: ['title','description','subtitle'] },
  articles: { summary: ['slug','title','description','subtitle','publishedAt','updatedAt','type','howto','authors','technologies','series','cover'], full: ['resources','body','contentResources'], searchable: ['title','description','subtitle'] },
  news: { summary: ['slug','title','description','publishedAt','authors','technologies','cover'], full: ['body'], searchable: ['title','description'] },
  shows: { summary: ['slug','name','status','tagline','description','hosts','cover'], full: ['episodes','podcast','subscribeLinks','gameFormatUrl','terms','body'], searchable: ['name','description','tagline'] },
  episodes: { summary: ['slug','code','terms','video','show','title'], full: ['body'], searchable: ['code','title'] },
  people: { summary: ['slug','name','forename','surname','avatarUrl','cover'], full: ['biography','links','github','twitter','bluesky','mastodon','linkedin','website','youtube','githubHandle','githubUrl','terms','body'], searchable: ['name','forename','surname','biography'] },
  technologies: { summary: ['slug','name','description','category','subcategory','icon','logo','cover'], full: ['logos','aliases','features','relatedTechnologies','useCases','seo','documentation','source','license','status','website','cncf','community','matrix','terms','body','learningResources'], searchable: ['name','description'] },
  series: { summary: ['slug','title','description','cover'], full: ['body'], searchable: ['title','description'] },
  courses: { summary: ['slug','title','description','publishedAt','updatedAt','difficulty','authors','cover'], full: ['learningPath','technologies','modules','body','contentResources'], searchable: ['title','description'] },
  'course-modules': { summary: ['slug','title','description','publishedAt','difficulty','order','section','course','video','cover'], full: ['learningPath','authors','resources','body','contentResources'], searchable: ['title','description'] },
  'learning-paths': { summary: ['slug','title','description','publishedAt','difficulty','estimatedDuration','cover'], full: ['prerequisites','authors','courses','videos','technologies','body'], searchable: ['title','description'] },
  chapters: { summary: ['slug','title','startTime'], full: ['body'], searchable: ['title'] },
  'learning-resources': { summary: ['slug','title','cover'], full: ['official','community','tutorials','body'], searchable: ['title'] },
  adrs: { summary: ['slug','title','adoptedAt','authors','cover'], full: ['body'], searchable: ['title'] },
  changelog: { summary: ['slug','title','description','date','type','pullRequest','author','cover'], full: ['body'], searchable: ['title','description'] },
  testimonials: { summary: ['slug','quote','author','type','cover'], full: ['body'], searchable: ['quote'] },
}

type RelationFilter = { field: string; many: boolean }
const relationFilters: Record<string, Partial<Record<PublicContentCollection, RelationFilter>>> = {
  authorId: Object.fromEntries(['articles','news','courses','course-modules','learning-paths','adrs'].map(collection => [collection, { field: 'authors', many: true }])) as Partial<Record<PublicContentCollection, RelationFilter>>,
  technologyId: Object.fromEntries(['videos','articles','news','courses','learning-paths'].map(collection => [collection, { field: 'technologies', many: true }])) as Partial<Record<PublicContentCollection, RelationFilter>>,
  showId: { videos: { field: 'show', many: false }, episodes: { field: 'show', many: false } },
  courseId: { 'course-modules': { field: 'course', many: false } },
  seriesId: { articles: { field: 'series', many: false } },
  personId: { videos: { field: 'guests', many: true }, shows: { field: 'hosts', many: true } },
}
const scalarFilters: Record<string, Partial<Record<PublicContentCollection, string>>> = {
  type: { videos: 'type', articles: 'type', testimonials: 'type' },
  category: { videos: 'category', technologies: 'category' },
}
const stableOrder: Record<PublicContentCollection, string> = {
  videos: '-publishedAt,sourceOrder,slug,id', articles: '-publishedAt,sourceOrder,slug,id', news: '-publishedAt,sourceOrder,slug,id',
  courses: '-publishedAt,sourceOrder,slug,id', 'course-modules': 'sourceOrder,slug,id', 'learning-paths': '-publishedAt,sourceOrder,slug,id',
  shows: 'sourceOrder,slug,id', episodes: 'sourceOrder,slug,id', people: 'sourceOrder,slug,id', technologies: 'sourceOrder,slug,id',
  series: 'sourceOrder,slug,id', chapters: 'sourceOrder,slug,id', 'learning-resources': 'sourceOrder,slug,id', adrs: '-adoptedAt,sourceOrder,slug,id',
  changelog: '-date,sourceOrder,slug,id', testimonials: 'sourceOrder,slug,id',
}
const mediaInternalFields = ['sourcePath','sourceAssets','cover','logo','icon']
const privateFields = new Set(['sourcePath','sourceAssets','sourceFields','sourceSystem','sourceRevision','sourceHash','sourceSequence','sourceOrder','mappingVersion','importedAt','importState','locallyEdited','legacyId','r2Key','password','email','profileEmail','identityKey','oidcIssuer','oidcSubject'])

export type CollectionRequest = {
  collection: PublicContentCollection
  view: 'summary' | 'full'
  id?: string
  slug?: string
  page: number
  limit: number
  filters: Record<string, string>
}

function dirname(value: string): string {
  const index = value.lastIndexOf('/')
  return index < 0 ? '.' : index === 0 ? '/' : value.slice(0, index)
}

function normalizePath(value: string): string {
  const absolute = value.startsWith('/')
  const parts: string[] = []
  for (const part of value.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (parts.length) parts.pop()
      else if (!absolute) parts.push('..')
    } else parts.push(part)
  }
  return `${absolute ? '/' : ''}${parts.join('/')}` || (absolute ? '/' : '.')
}

function relativePath(from: string, to: string): string {
  const left = from.split('/').filter(Boolean)
  const right = to.split('/').filter(Boolean)
  let common = 0
  while (common < left.length && common < right.length && left[common] === right[common]) common += 1
  return [...Array(left.length - common).fill('..'), ...right.slice(common)].join('/') || '.'
}

export function parseCollectionRequest(url: URL): CollectionRequest | null {
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length !== 3 || segments[0] !== 'v1' || segments[1] !== 'collections' || !collectionSet.has(segments[2]!)) return null
  const collection = segments[2] as PublicContentCollection
  // Chapters are child records. Expose them only through a visible video's
  // full projection so a future video's derived chapters cannot be listed or
  // fetched independently of their parent publication date.
  if (collection === 'chapters') return null
  const allowed = new Set(['id','slug','view','page','limit','authorId','technologyId','showId','courseId','seriesId','personId','type','category','q'])
  for (const key of url.searchParams.keys()) if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) throw new RequestError(400, 'Invalid query parameters')
  const values = Object.fromEntries(url.searchParams.entries())
  const view = values.view ?? (values.id || values.slug ? 'full' : 'summary')
  if (view !== 'summary' && view !== 'full') throw new RequestError(400, 'Invalid view')
  const exact = Boolean(values.id || values.slug)
  if (values.id && values.slug) throw new RequestError(400, 'Choose id or slug')
  if (exact) {
    if (Object.keys(values).some(key => !['id','slug','view'].includes(key))) throw new RequestError(400, 'Exact lookups do not accept list parameters')
    const value = values.id ?? values.slug!
    if (!value || value.length > 160) throw new RequestError(400, 'Invalid lookup key')
  } else if (values.view && view !== 'summary' && view !== 'full') throw new RequestError(400, 'Invalid view')
  for (const [filter, value] of Object.entries(values)) {
    if (filter in relationFilters && !relationFilters[filter]![collection]) throw new RequestError(400, `Unsupported filter: ${filter}`)
    if (filter in scalarFilters && !scalarFilters[filter]![collection]) throw new RequestError(400, `Unsupported filter: ${filter}`)
    if ((filter in relationFilters || filter in scalarFilters) && (!value.trim() || value.length > 160)) throw new RequestError(400, `Invalid ${filter}`)
    if (filter === 'q' && (!value.trim() || value.length > 100 || /[\u0000-\u001f\u007f]/.test(value))) throw new RequestError(400, 'q must contain 1 to 100 printable characters')
  }
  if (('id' in values && !values.id) || ('slug' in values && !values.slug)) throw new RequestError(400, 'Lookup key cannot be empty')
  const page = values.page === undefined ? 1 : Number(values.page)
  const limit = values.limit === undefined ? 50 : Number(values.limit)
  if (!exact && (!Number.isSafeInteger(page) || page < 1 || page > 1000)) throw new RequestError(400, 'page must be between 1 and 1000')
  if (!exact && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)) throw new RequestError(400, 'limit must be between 1 and 100')
  if (!exact && values.q && limit > 50) throw new RequestError(400, 'limit must be 50 or less when q is used')
  return { collection, view, ...(values.id ? { id: values.id } : {}), ...(values.slug ? { slug: values.slug } : {}), page, limit, filters: Object.fromEntries(Object.entries(values).filter(([key]) => key in relationFilters || key in scalarFilters || key === 'q')) }
}

export class RequestError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export function isVisibleDocument(collection: PublicContentCollection | 'static-assets', doc: Record<string, unknown>, now = Date.now()): { visible: boolean; metadataOnly: boolean } {
  // Payload omits `_status` entirely when versions.drafts is false. Static
  // assets use that schema, so their published state is the only stored state.
  if ((collection === 'static-assets' ? doc._status === 'draft' : doc._status !== 'published') || doc.tombstone === true) return { visible: false, metadataOnly: false }
  if (doc.publishedAt === undefined || doc.publishedAt === null || doc.publishedAt === '') return { visible: true, metadataOnly: false }
  const publishedAt = Date.parse(String(doc.publishedAt))
  if (!Number.isFinite(publishedAt)) return { visible: false, metadataOnly: false }
  if (publishedAt <= now) return { visible: true, metadataOnly: false }
  if (collection === 'videos' && doc.type === 'live') return { visible: true, metadataOnly: true }
  return { visible: false, metadataOnly: false }
}

function publicWhere(request: CollectionRequest, now: number, scheduledOnly = false): Query {
  const collection = request.collection
  const and: Query[] = [{ _status: { equals: 'published' } }, { tombstone: { not_equals: true } }]
  for (const [filter, value] of Object.entries(request.filters)) {
    if (filter === 'q') {
      and.push({ or: collectionFields[collection].searchable.map(field => ({ [field]: { contains: value } })) })
    } else if (filter in relationFilters) {
      const mapping = relationFilters[filter]![collection]!
      and.push({ [mapping.field]: { [mapping.many ? 'contains' : 'equals']: value } })
    } else {
      const field = scalarFilters[filter]![collection]!
      and.push({ [field]: { equals: value } })
    }
  }
  if (dateCollections.has(collection)) {
    if (scheduledOnly) and.push({ publishedAt: { greater_than: new Date(now).toISOString() } })
    else if (collection === 'videos') and.push({ or: [
      { publishedAt: { exists: false } }, { publishedAt: { equals: null } }, { publishedAt: { less_than_equal: new Date(now).toISOString() } },
      { and: [{ type: { equals: 'live' } }, { publishedAt: { greater_than: new Date(now).toISOString() } }] },
    ] })
    else and.push({ or: [{ publishedAt: { exists: false } }, { publishedAt: { equals: null } }, { publishedAt: { less_than_equal: new Date(now).toISOString() } }] })
  }
  return { and }
}

function selectFields(collection: PublicContentCollection, view: 'summary' | 'full'): Record<string, true> {
  const selected = new Set([...collectionFields[collection].summary, ...(view === 'full' ? collectionFields[collection].full : []), ...mediaInternalFields, 'id','_status','tombstone','publishedAt','type','sourceOrder'])
  return Object.fromEntries([...selected].map(field => [field, true]))
}

function safeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeValue)
  if (!value || typeof value !== 'object') return value
  const object = value as Record<string, unknown>
  const keys = Object.keys(object)
  if ('value' in object && keys.every(key => ['id','_order','_uuid','value'].includes(key))) return safeValue(object.value)
  if ('id' in object && keys.every(key => ['id','relationTo'].includes(key))) return String(object.id)
  return Object.fromEntries(Object.entries(object)
    .filter(([key]) => !privateFields.has(key) && !['id','_order','_uuid'].includes(key))
    .map(([key, child]) => [key, safeValue(child)]))
}

function projectFields(doc: Doc, collection: PublicContentCollection, view: 'summary' | 'full', metadataOnly = false): Record<string, unknown> {
  const allowed = new Set(['id','slug', ...collectionFields[collection].summary, ...(view === 'full' ? collectionFields[collection].full : [])])
  const summary = new Set(collectionFields[collection].summary)
  const output: Record<string, unknown> = { id: String(doc.id) }
  for (const field of allowed) {
    if (field === 'id' || privateFields.has(field) || !(field in doc)) continue
    // Future live streams may advertise public metadata, but exact ID/slug
    // lookups default to the full view. Keep them on the summary projection
    // until publishedAt, including when a publication overlay is present.
    if (metadataOnly && !summary.has(field)) continue
    output[field] = field === 'contentResources' ? publicContentResources(doc[field]) : safeValue(doc[field])
  }
  return output
}

/** Demo source stays on the selected-resource bridge route, not general CMS projections. */
function publicContentResources(value: unknown): unknown {
  const safe = safeValue(value)
  const stripDemoInternals = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(stripDemoInternals)
    if (!current || typeof current !== 'object') return current
    const record = current as Record<string, unknown>
    const output: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(record)) {
      if (key === 'embedConfig' && child && typeof child === 'object' && !Array.isArray(child)) {
        const config = child as Record<string, unknown>
        const publicConfig: Record<string, unknown> = {}
        for (const [field, nested] of Object.entries(config)) if (field !== 'files' && field !== 'import') publicConfig[field] = stripDemoInternals(nested)
        output[key] = publicConfig
      } else {
        output[key] = stripDemoInternals(child)
      }
    }
    return output
  }
  return stripDemoInternals(safe)
}

function chapterReferenceId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id === 'string' || typeof record.id === 'number') return String(record.id)
  if (typeof record.value === 'string' || typeof record.value === 'number') return String(record.value)
  return null
}

function isChapterData(value: unknown): value is { title: string; startTime: number } {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.title === 'string' && typeof record.startTime === 'number'
}

/** Restore the former inline video chapter shape from Payload's normalized relation IDs. */
async function hydrateVideoChapters(payload: PublicPayload, docs: Record<string, unknown>[], now = Date.now()): Promise<void> {
  const references = docs.flatMap(doc => Array.isArray(doc.chapters) ? doc.chapters.filter(value => !isChapterData(value)).map(chapterReferenceId).filter((id): id is string => id !== null) : [])
  const ids = [...new Set(references)].slice(0, 8000)
  const chapters = new Map<string, { title: string; startTime: number }>()
  for (let index = 0; index < ids.length; index += 100) {
    const batch = ids.slice(index, index + 100)
    const result = await payload.find({
      collection: 'chapters', where: { and: [{ id: { in: batch } }, { _status: { equals: 'published' } }, { tombstone: { not_equals: true } }] }, depth: 0, draft: false,
      overrideAccess: true, user: null, page: 1, limit: batch.length,
      select: { id: true, title: true, startTime: true, _status: true, tombstone: true },
    } as never)
    for (const chapter of result.docs as unknown as Doc[]) {
      const visible = isVisibleDocument('chapters', chapter, now).visible
      if (!visible || typeof chapter.title !== 'string' || typeof chapter.startTime !== 'number') continue
      chapters.set(String(chapter.id), { title: chapter.title, startTime: chapter.startTime })
    }
  }
  for (const doc of docs) {
    if (!Array.isArray(doc.chapters)) continue
    doc.chapters = doc.chapters.flatMap(value => {
      if (isChapterData(value)) return [value]
      const id = chapterReferenceId(value)
      const chapter = id ? chapters.get(id) : undefined
      return chapter ? [chapter] : []
    })
  }
}

function assetReferencePaths(doc: Doc, collection: PublicContentCollection, view: 'summary' | 'full'): string[] {
  if (typeof doc.sourcePath !== 'string' || !Array.isArray(doc.sourceAssets)) return []
  const ownerDirectory = dirname(doc.sourcePath)
  const all = (doc.sourceAssets as unknown[]).flatMap(asset => {
    if (!asset || typeof asset !== 'object' || typeof (asset as Record<string, unknown>).relativePath !== 'string') return []
    return [(asset as Record<string, unknown>).relativePath as string]
  }).filter(value => !value.startsWith('/') && !value.split('/').includes('..'))
  if (view === 'full') return all.slice(0, 64)
  const candidates: unknown[] = [
    (doc.cover as Record<string, unknown> | undefined)?.image,
    doc.logo,
    doc.icon,
  ]
  const wanted = new Set(candidates.flatMap(value => {
    if (typeof value !== 'string' || !/^\.\.?\//.test(value)) return []
    const normalized = normalizePath(`${ownerDirectory}/${value}`)
    return normalized.startsWith('../') ? [] : [normalized]
  }))
  return all.filter(value => wanted.has(value)).slice(0, 8)
}

async function loadAssetDocs(payload: PublicPayload, paths: string[]): Promise<Map<string, Doc>> {
  const unique = [...new Set(paths)].slice(0, 8000)
  const docs = new Map<string, Doc>()
  for (let index = 0; index < unique.length; index += 80) {
    const slugs = unique.slice(index, index + 80)
    const result = await payload.find({
      collection: 'static-assets', depth: 0, limit: slugs.length, page: 1, draft: false,
      overrideAccess: true, user: null, select: { id: true, slug: true, tombstone: true, checksum: true, mimeType: true, alt: true },
      where: { and: [{ slug: { in: slugs } }, { tombstone: { not_equals: true } }] },
    } as never)
    for (const doc of result.docs as unknown as Doc[]) if (typeof doc.slug === 'string' && isVisibleDocument('static-assets', doc).visible) docs.set(doc.slug, doc)
  }
  return docs
}

function cacheHeaders(nextReleaseAt: string | null, now = Date.now()): Headers {
  let maxAge = 30
  if (nextReleaseAt) maxAge = Math.max(0, Math.min(maxAge, Math.floor((Date.parse(nextReleaseAt) - now) / 1000)))
  // A pending release is an exact visibility boundary. Do not let a cached
  // pre-release response remain eligible for stale serving after that time.
  const staleWhileRevalidate = 0
  return new Headers({ 'Cache-Control': `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`, 'Content-Type': 'application/json; charset=utf-8' })
}

async function earliestNextRelease(payload: PublicPayload, request: CollectionRequest, now: number): Promise<string | null> {
  if (!dateCollections.has(request.collection)) return null
  const result = await payload.find({
    collection: request.collection, where: publicWhere(request, now, true), depth: 0, draft: false,
    overrideAccess: true, user: null, page: 1, limit: 1, sort: 'publishedAt', select: { id: true, publishedAt: true, type: true },
  } as never)
  const dates = (result.docs as unknown as Doc[]).flatMap(doc => {
    if (doc.publishedAt === undefined || doc.publishedAt === null) return []
    const value = Date.parse(String(doc.publishedAt))
    return Number.isFinite(value) && value > now ? [value] : []
  })
  return dates.length ? new Date(Math.min(...dates)).toISOString() : null
}

async function overlayVideos(payload: PublicPayload, docs: Doc[]): Promise<Map<string, Record<string, unknown>>> {
  if (!docs.length) return new Map()
  const ids = docs.map(doc => String(doc.id))
  const result = await payload.find({
    collection: 'video-publications', where: { id: { in: ids } }, limit: ids.length, page: 1,
    draft: false, overrideAccess: true, user: null, depth: 0, select: { id: true, document: true },
  } as never)
  return new Map((result.docs as unknown as Doc[]).flatMap(row => {
    if (!row.document || typeof row.document !== 'object') return []
    return [[String(row.id), row.document as Record<string, unknown>]]
  }))
}

export async function collectionResponse(request: Request, payload: PublicPayload, now = Date.now()): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  let parsed: CollectionRequest | null
  try { parsed = parseCollectionRequest(new URL(request.url)) } catch (error) {
    if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status })
    throw error
  }
  if (!parsed) return Response.json({ error: 'Not found' }, { status: 404 })
  const requestQuery: Query = {
    collection: parsed.collection,
    where: parsed.id ? { and: [publicWhere(parsed, now), { id: { equals: parsed.id } }] }
      : parsed.slug ? { and: [publicWhere(parsed, now), { slug: { equals: parsed.slug } }] } : publicWhere(parsed, now),
    depth: 0, draft: false, overrideAccess: true, user: null, sort: stableOrder[parsed.collection], select: selectFields(parsed.collection, parsed.view),
  }
  const exact = Boolean(parsed.id || parsed.slug)
  const query = exact ? { ...requestQuery, page: 1, limit: 2 } : { ...requestQuery, page: parsed.page, limit: parsed.limit }
  const result = await payload.find(query as never)
  const rawDocs = result.docs as unknown as Doc[]
  const visible = rawDocs.filter(doc => isVisibleDocument(parsed!.collection, doc, now).visible)
  if (exact && visible.length > 1) return Response.json({ error: 'The requested slug is ambiguous' }, { status: 409 })
  const overlay = parsed.collection === 'videos' ? await overlayVideos(payload, visible) : new Map<string, Record<string, unknown>>()
  const viewForDoc = (doc: Doc): 'summary' | 'full' =>
    isVisibleDocument(parsed!.collection, doc, now).metadataOnly ? 'summary' : parsed!.view
  const assetPaths = visible.flatMap(doc => assetReferencePaths(doc, parsed!.collection, viewForDoc(doc)))
  const assetDocs = await loadAssetDocs(payload, assetPaths)
  const docs = visible.map(doc => {
    const visibility = isVisibleDocument(parsed!.collection, doc, now)
    const base = projectFields(doc, parsed!.collection, parsed!.view, visibility.metadataOnly)
    const released = overlay.get(String(doc.id))
    const publishedDocument = released && isVisibleDocument('videos', released, now).visible
      ? { ...doc, ...released, ...(Array.isArray(released.reviewChapters) ? { chapters: released.reviewChapters } : {}), id: doc.id }
      : undefined
    const merged = publishedDocument
      ? projectFields(publishedDocument, 'videos', parsed!.view, visibility.metadataOnly)
      : base
    const assets = assetReferencePaths(doc, parsed!.collection, viewForDoc(doc)).flatMap(rootPath => {
      const asset = assetDocs.get(rootPath)
      if (!asset) return []
      const ownerDirectory = typeof doc.sourcePath === 'string' ? dirname(doc.sourcePath) : ''
      return [{ relativePath: relativePath(ownerDirectory, rootPath), assetId: String(asset.id), checksum: String(asset.checksum ?? ''), mimeType: String(asset.mimeType ?? 'application/octet-stream'), alt: String(asset.alt ?? '') }]
    })
    return { ...merged, mediaAssets: assets }
  })
  if (parsed.collection === 'videos' && parsed.view === 'full') await hydrateVideoChapters(payload, docs, now)
  const nextReleaseAt = exact
    ? (visible[0] && visible[0].publishedAt && Date.parse(String(visible[0].publishedAt)) > now ? new Date(Date.parse(String(visible[0].publishedAt))).toISOString() : null)
    : await earliestNextRelease(payload, parsed, now)
  const headers = cacheHeaders(nextReleaseAt, now)
  if (exact) {
    if (!docs.length) return Response.json({ error: 'Not found' }, { status: 404, headers })
    return Response.json({ doc: docs[0], nextReleaseAt }, { headers })
  }
  return Response.json({ docs, page: parsed.page, limit: parsed.limit, hasNextPage: Boolean(result.hasNextPage), nextReleaseAt }, { headers })
}

export async function assetResponse(request: Request, payload: PublicPayload, bucket: R2Bucket, now = Date.now()): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  if (new URL(request.url).searchParams.size || segments.length !== 3 || segments[0] !== 'v1' || segments[1] !== 'assets' || !isCuid2(segments[2])) return Response.json({ error: 'Not found' }, { status: 404 })
  const doc = await (payload as Payload).findByID({ collection: 'static-assets', id: segments[2], depth: 0, draft: false, overrideAccess: true, user: null } as never).catch(() => null) as unknown as Doc | null
  const checksum = typeof doc?.checksum === 'string' ? doc.checksum : ''
  const r2Key = typeof doc?.r2Key === 'string' ? doc.r2Key : ''
  const sourcePath = typeof doc?.slug === 'string' ? doc.slug : ''
  const bytes = doc?.bytes
  const mimeType = typeof doc?.mimeType === 'string' ? doc.mimeType : ''
  const keyParts = r2Key.split('/')
  if (!doc || !isVisibleDocument('static-assets', doc, now).visible || !sha256Pattern.test(checksum) || !sourcePath || !Number.isSafeInteger(bytes) || (bytes as number) <= 0 || !mimeType || keyParts.length < 3 || keyParts[0] !== 'static' || keyParts[1] !== checksum.slice(0, 16) || keyParts.slice(2).join('/') !== sourcePath || keyParts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))) return Response.json({ error: 'Not found' }, { status: 404 })
  const object = await bucket.get(r2Key)
  if (!object || object.customMetadata?.checksum !== checksum || object.customMetadata?.sourcePath !== sourcePath || object.size !== bytes || object.httpMetadata?.contentType !== mimeType) return Response.json({ error: 'Not found' }, { status: 404 })
  const headers = new Headers({
    'Content-Type': mimeType,
    'Cache-Control': 'public, max-age=0, s-maxage=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  headers.set('ETag', `"${checksum}"`)
  headers.set('Content-Length', String(bytes))
  return new Response(object.body, { headers })
}

const sha256Pattern = /^[a-f0-9]{64}$/
export async function diagramResponse(request: Request, bucket: R2Bucket): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const match = segments.length === 3 && segments[0] === 'v1' && segments[1] === 'diagrams' ? /^([a-f0-9]{64})\.svg$/.exec(segments[2]!) : null
  if (url.searchParams.size || !match) return Response.json({ error: 'Not found' }, { status: 404 })
  const sourceChecksum = match[1]!
  const object = await bucket.get(`derived-diagrams/${sourceChecksum}.svg`)
  const metadata = object?.customMetadata
  const contentChecksum = metadata?.svgChecksum
  if (!object || metadata?.sourceChecksum !== sourceChecksum || typeof contentChecksum !== 'string' || !sha256Pattern.test(contentChecksum)) return Response.json({ error: 'Not found' }, { status: 404 })
  const headers = new Headers({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'X-Source-Checksum': sourceChecksum,
    'X-Content-Checksum': contentChecksum,
    ETag: `"${contentChecksum}"`,
  })
  return new Response(object.body, { headers })
}

export type DemoRequest = { course: string; module: string; resource: string }
const demoSlugPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/
const demoFileExtensions = new Set(['.astro','.c','.cc','.cpp','.cs','.cjs','.css','.go','.graphql','.h','.hpp','.html','.java','.js','.json','.jsonc','.jsx','.md','.mdx','.mjs','.php','.py','.rb','.rs','.sh','.sql','.svg','.toml','.ts','.tsx','.txt','.vue','.xml','.yaml','.yml'])
const demoFileNames = new Set(['dockerfile','license','makefile'])
const maxDemoFiles = 100
const maxDemoFileBytes = 256 * 1024
const maxDemoBytes = 1024 * 1024
const maxDemoPathLength = 240

export function parseDemoRequest(url: URL): DemoRequest | null {
  if (url.pathname !== '/v1/demos') return null
  const allowed = new Set(['course','module','resource'])
  for (const key of url.searchParams.keys()) if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) throw new RequestError(400, 'Invalid demo query parameters')
  const course = url.searchParams.get('course') ?? ''
  const module = url.searchParams.get('module') ?? ''
  const resource = url.searchParams.get('resource') ?? ''
  const moduleParts = module.split('/')
  if (!demoSlugPattern.test(course) || !demoSlugPattern.test(resource) || module.length > 240 || moduleParts.length < 2 || moduleParts[0] !== course || moduleParts.some(part => !demoSlugPattern.test(part) || part === '.' || part === '..')) {
    throw new RequestError(400, 'course, module, and resource must be valid matching slugs')
  }
  if (url.searchParams.size !== 3) throw new RequestError(400, 'course, module, and resource are required')
  return { course, module, resource }
}

function relationID(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = (value as Record<string, unknown>).id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null
}

function nextVisibleBoundary(documents: Doc[], now: number): string | null {
  const future = documents.flatMap(doc => {
    if (doc._status !== 'published' || doc.tombstone === true || doc.publishedAt === undefined || doc.publishedAt === null) return []
    const value = Date.parse(String(doc.publishedAt))
    return Number.isFinite(value) && value > now ? [value] : []
  })
  return future.length ? new Date(Math.min(...future)).toISOString() : null
}

function inlineDemoFiles(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value as Record<string, unknown>)
  if (!entries.length || entries.length > maxDemoFiles) return null
  const output: Record<string, string> = {}
  let totalBytes = 0
  for (const [filePath, content] of entries) {
    const segments = filePath.split('/')
    const filename = filePath.split('/').at(-1)?.toLowerCase() ?? ''
    const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
    if (!filePath || filePath.length > maxDemoPathLength || filePath.startsWith('/') || filePath.includes('\\') || /[\u0000-\u001f\u007f]/.test(filePath) || segments.some(part => !part || part === '.' || part === '..' || part.startsWith('.')) || (!demoFileExtensions.has(extension) && !demoFileNames.has(filename)) || typeof content !== 'string') return null
    const bytes = new TextEncoder().encode(content).byteLength
    if (bytes > maxDemoFileBytes) return null
    totalBytes += bytes
    if (totalBytes > maxDemoBytes) return null
    output[filePath] = content
  }
  return output
}

export async function demoResponse(request: Request, payload: PublicPayload, now = Date.now()): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  let parsed: DemoRequest | null
  try { parsed = parseDemoRequest(new URL(request.url)) } catch (error) {
    if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status })
    throw error
  }
  if (!parsed) return Response.json({ error: 'Not found' }, { status: 404 })

  const courseResult = await payload.find({
    collection: 'courses', where: { and: [{ slug: { equals: parsed.course } }, { _status: { equals: 'published' } }, { tombstone: { not_equals: true } }] },
    depth: 0, draft: false, overrideAccess: true, user: null, page: 1, limit: 2,
    select: { id: true, slug: true, _status: true, tombstone: true, publishedAt: true },
  } as never)
  const courseDocs = courseResult.docs as unknown as Doc[]
  const course = courseDocs.length === 1 ? courseDocs[0] : undefined
  if (!course || !isVisibleDocument('courses', course, now).visible) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: cacheHeaders(nextVisibleBoundary(courseDocs, now), now) })
  }

  const moduleResult = await payload.find({
    collection: 'course-modules', where: { and: [{ slug: { equals: parsed.module } }, { course: { equals: course.id } }, { _status: { equals: 'published' } }, { tombstone: { not_equals: true } }] },
    depth: 0, draft: false, overrideAccess: true, user: null, page: 1, limit: 2,
    select: { id: true, slug: true, course: true, _status: true, tombstone: true, publishedAt: true, contentResources: true },
  } as never)
  const moduleDocs = moduleResult.docs as unknown as Doc[]
  const module = moduleDocs.length === 1 ? moduleDocs[0] : undefined
  if (!module || relationID(module.course) !== String(course.id) || !isVisibleDocument('course-modules', module, now).visible) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: cacheHeaders(nextVisibleBoundary(moduleDocs, now), now) })
  }

  const resources = Array.isArray(module.contentResources) ? module.contentResources : []
  const matches = resources.filter(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const resource = value as Record<string, unknown>
    const embedConfig = resource.embedConfig
    if (resource.type !== 'embed' || !embedConfig || typeof embedConfig !== 'object' || Array.isArray(embedConfig)) return false
    const config = embedConfig as Record<string, unknown>
    const identifiers = [resource.id, resource.slug, config.src].filter((value): value is string => typeof value === 'string')
    return config.container === 'webcontainer' && identifiers.includes(parsed!.resource)
  }) as Record<string, unknown>[]
  if (matches.length !== 1) return Response.json({ error: 'Not found' }, { status: 404, headers: cacheHeaders(null, now) })
  const embedConfig = matches[0]!.embedConfig as Record<string, unknown>
  const files = inlineDemoFiles(embedConfig.files)
  const startCommand = embedConfig.startCommand
  if (!files) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: cacheHeaders(null, now) })
  }
  const resource = matches[0]!
  const title = typeof resource.title === 'string' && resource.title.trim() && resource.title.length <= 200 && !/[\u0000-\u001f\u007f]/.test(resource.title)
    ? resource.title
    : parsed.resource
  const description = typeof resource.description === 'string' && resource.description.trim() && resource.description.length <= 500 && !/[\u0000-\u001f\u007f]/.test(resource.description)
    ? resource.description
    : undefined
  const safeStartCommand = typeof startCommand === 'string' && startCommand.trim() && startCommand.length <= 200 && !/[\u0000-\u001f\u007f]/.test(startCommand)
    ? startCommand
    : undefined
  return Response.json({ title, ...(description ? { description } : {}), files, ...(safeStartCommand ? { startCommand: safeStartCommand } : {}) }, { headers: cacheHeaders(null, now) })
}

export async function publicContentBridge(request: Request, payload: PublicPayload, bucket: R2Bucket): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname.startsWith('/v1/assets/')) return assetResponse(request, payload, bucket)
  if (url.pathname.startsWith('/v1/diagrams/')) return diagramResponse(request, bucket)
  if (url.pathname === '/v1/demos') return demoResponse(request, payload)
  return collectionResponse(request, payload)
}
