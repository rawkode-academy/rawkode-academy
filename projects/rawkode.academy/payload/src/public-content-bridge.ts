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
  videos: { summary: ['slug','title','tagline','subtitle','description','publishedAt','duration','type','category','thumbnailUrl','show','technologies','guests','episode','terms','cover'], full: ['whatYouWillLearn','streamUrl','youtubeId','podcast','subscribeLinks','chapters','audioFileSize','body'], searchable: ['title','description','subtitle'] },
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
  const output: Record<string, unknown> = { id: String(doc.id) }
  for (const field of allowed) {
    if (field === 'id' || privateFields.has(field) || !(field in doc)) continue
    if (metadataOnly && ['streamUrl','youtubeId','podcast'].includes(field)) continue
    output[field] = safeValue(doc[field])
  }
  return output
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
  const assetPaths = visible.flatMap(doc => assetReferencePaths(doc, parsed!.collection, parsed!.view))
  const assetDocs = await loadAssetDocs(payload, assetPaths)
  const docs = visible.map(doc => {
    const visibility = isVisibleDocument(parsed!.collection, doc, now)
    const base = projectFields(doc, parsed!.collection, parsed!.view, visibility.metadataOnly)
    const released = overlay.get(String(doc.id))
    const merged = released && isVisibleDocument('videos', released, now).visible ? projectFields({ ...doc, ...released, id: doc.id }, 'videos', parsed!.view, visibility.metadataOnly) : base
    const assets = assetReferencePaths(doc, parsed!.collection, parsed!.view).flatMap(rootPath => {
      const asset = assetDocs.get(rootPath)
      if (!asset) return []
      const ownerDirectory = typeof doc.sourcePath === 'string' ? dirname(doc.sourcePath) : ''
      return [{ relativePath: relativePath(ownerDirectory, rootPath), assetId: String(asset.id), checksum: String(asset.checksum ?? ''), mimeType: String(asset.mimeType ?? 'application/octet-stream'), alt: String(asset.alt ?? '') }]
    })
    return { ...merged, mediaAssets: assets }
  })
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
  if (!doc || !isVisibleDocument('static-assets', doc, now).visible || typeof doc.r2Key !== 'string' || !doc.r2Key) return Response.json({ error: 'Not found' }, { status: 404 })
  const object = await bucket.get(doc.r2Key)
  if (!object) return Response.json({ error: 'Not found' }, { status: 404 })
  const headers = new Headers({
    'Content-Type': typeof doc.mimeType === 'string' ? doc.mimeType : 'application/octet-stream',
    'Cache-Control': 'public, max-age=0, s-maxage=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  const checksum = typeof doc.checksum === 'string' ? doc.checksum : ''
  if (checksum) headers.set('ETag', `"${checksum}"`)
  if (typeof doc.bytes === 'number' && doc.bytes >= 0) headers.set('Content-Length', String(doc.bytes))
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

export async function publicContentBridge(request: Request, payload: PublicPayload, bucket: R2Bucket): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname.startsWith('/v1/assets/')) return assetResponse(request, payload, bucket)
  if (url.pathname.startsWith('/v1/diagrams/')) return diagramResponse(request, bucket)
  return collectionResponse(request, payload)
}
