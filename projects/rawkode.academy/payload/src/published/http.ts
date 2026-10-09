import type { Catalogue, CatalogueDocument } from '../catalogue'
import { legacyIdPattern } from '../editorial/contracts'
import { effectiveTimes, type EditorialTimesV1 } from '../editorial/effective'
import { availability, PUBLISHED_CONTRACT_VERSION, PublishedVideoListV1, PublishedVideoV1, type Availability, type PublishedVideo } from './contract'

export type PublishedRuntime = { catalogue: Catalogue; now: () => number; cache?: Cache }
type Entry = { video: CatalogueDocument; times: EditorialTimesV1; state: Availability }
class PublishedError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

const includable = ['upcoming', 'live', 'ended'] as const
const listParams = ['include', 'cursor', 'limit'] as const
const noStore = { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' }
const fail = (error: unknown) => error instanceof PublishedError
  ? Response.json({ error: error.message }, { status: error.status, headers: noStore })
  : Response.json({ error: 'Published read failed' }, { status: 500, headers: noStore })

export function publishedLegacyId(value: string) {
  if (!legacyIdPattern.test(value)) throw new PublishedError(400, 'Invalid video id')
  return value
}

function listQuery(url: URL) {
  const include = new Set<Availability>(['available'])
  for (const value of (url.searchParams.get('include') ?? '').split(',').map(item => item.trim()).filter(Boolean)) {
    if (!(includable as readonly string[]).includes(value)) throw new PublishedError(400, 'include accepts upcoming, live and ended')
    include.add(value as Availability)
  }
  const cursor = url.searchParams.get('cursor')
  if (cursor !== null) publishedLegacyId(cursor)
  const limitValue = url.searchParams.get('limit') ?? '50'
  if (!/^[1-9]\d{0,2}$/.test(limitValue) || Number(limitValue) > 100) throw new PublishedError(400, 'limit must be 1 to 100')
  return { include, cursor, limit: Number(limitValue) }
}

const text = (value: unknown) => (typeof value === 'string' ? value : null)
const absolute = (value: unknown) => {
  if (typeof value !== 'string') return null
  try { return /^https?:$/.test(new URL(value).protocol) ? value : null } catch { return null }
}
const rank: Record<Availability, number> = { live: 0, upcoming: 1, ended: 2, available: 3 }
const time = (value: string | null) => (value ? Date.parse(value) : 0)
// Live first (newest start), then upcoming (soonest), ended (newest end), then
// available (newest release); legacyId breaks ties.
function compare(a: Entry, b: Entry) {
  if (a.state !== b.state) return rank[a.state] - rank[b.state]
  const key = (entry: Entry) => entry.state === 'live' ? -time(entry.times.broadcastStartedAt)
    : entry.state === 'upcoming' ? time(entry.times.scheduledStartAt)
    : entry.state === 'ended' ? -time(entry.times.broadcastEndedAt ?? entry.times.broadcastStartedAt)
    : -time(entry.times.publishedAt)
  return key(a) - key(b) || a.video.legacyId.localeCompare(b.video.legacyId)
}

async function entries(catalogue: Catalogue, now: number): Promise<Entry[]> {
  const videos = await catalogue.all('videos')
  const rows = await catalogue.editorialTimes(videos.map(video => Number(video.id)).filter(Number.isSafeInteger))
  const visible: Entry[] = []
  for (const video of videos) {
    // Catalogue already restricts to published, non-tombstoned documents.
    const times = effectiveTimes(rows.get(Number(video.id)), { type: video.type, _status: video._status, publishedAt: video.publishedAt })
    const state = availability(video.type, times, now)
    if (state) visible.push({ video, times, state })
  }
  return visible.sort(compare)
}

async function item(catalogue: Catalogue, { video, times, state }: Entry): Promise<PublishedVideo> {
  const [show, guests, technologies, chapters] = await Promise.all([
    catalogue.relationship('shows', video.show),
    catalogue.relationships('people', video.guests),
    catalogue.relationships('technologies', video.technologies),
    Array.isArray(video.reviewChapters) ? Promise.resolve(video.reviewChapters as CatalogueDocument[]) : catalogue.relationships('chapters', video.chapters),
  ])
  const episode = video.episode ? await catalogue.relationship('episodes', video.episode) : (await catalogue.reverse('episodes', 'video', video))[0] ?? null
  const name = (person: CatalogueDocument) => text(person.name) ?? [person.forename, person.surname].filter(part => typeof part === 'string' && part).join(' ')
  const tagline = text(video.tagline)
  const subtitle = text(video.subtitle)
  const value: PublishedVideo = {
    contractVersion: PUBLISHED_CONTRACT_VERSION,
    id: video.legacyId,
    slug: text(video.slug) ?? video.legacyId,
    title: text(video.title) ?? '',
    description: text(video.description),
    ...(tagline ? { tagline } : {}),
    ...(subtitle ? { subtitle } : {}),
    type: video.type === 'live' || video.type === 'recorded' ? video.type : null,
    category: text(video.category),
    ...times,
    availability: state,
    duration: typeof video.duration === 'number' && video.duration >= 0 ? video.duration : null,
    streamUrl: absolute(video.streamUrl),
    thumbnailUrl: absolute(video.thumbnailUrl),
    chapters: chapters.map(chapter => ({ title: text(chapter.title) ?? '', startTime: Number(chapter.startTime ?? 0) })),
    show: show ? { id: show.legacyId, name: text(show.name) ?? text(show.title) ?? show.legacyId } : null,
    guests: guests.map(person => ({ id: person.legacyId, name: name(person) })),
    technologies: technologies.map(technology => technology.legacyId),
    episode: episode ? { id: episode.legacyId, code: text(episode.code) } : null,
    youtubeId: text(video.youtubeId),
  }
  // Fails closed: a mapping that drifts from the contract is a 500, never a bad body.
  return PublishedVideoV1.parse(value)
}

async function etagOf(body: { items: unknown; nextCursor?: unknown }) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ contractVersion: PUBLISHED_CONTRACT_VERSION, items: body.items, nextCursor: body.nextCursor ?? null })))
  return `"${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}"`
}
const matches = (header: string | null, etag: string) => Boolean(header && header.split(',').map(value => value.trim().replace(/^W\//, '')).some(value => value === '*' || value === etag))
const conditional = (request: Request, response: Response) =>
  matches(request.headers.get('if-none-match'), response.headers.get('etag') ?? '') ? new Response(null, { status: 304, headers: response.headers }) : response

// The ETag covers the items and cursor only, never generatedAt, so an unchanged
// list revalidates with 304 across requests.
// Nothing purges the Workers Cache API on publish, unpublish or tombstone, so the
// shared lifetime is the staleness bound of the contract: a withdrawn video can
// stay listed for at most publishedStaleSeconds (15 while anything is live or
// upcoming).
export const publishedStaleSeconds = 30
async function respond(body: unknown, items: PublishedVideo[], nextCursor: string | null = null) {
  const fresh = items.some(entry => entry.availability === 'live' || entry.availability === 'upcoming')
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': fresh ? 'public, max-age=15, s-maxage=15' : `public, max-age=${publishedStaleSeconds}, s-maxage=${publishedStaleSeconds}`,
      etag: await etagOf({ items, nextCursor }),
      'x-content-type-options': 'nosniff',
    },
  })
}

// Anonymous by construction: it never reads cookies or authorization, never calls
// payload.auth, and keys the cache only on the path and known query parameters.
export function createPublishedHandlers(load: () => Promise<PublishedRuntime>) {
  async function cached(request: Request, params: readonly string[], build: (runtime: PublishedRuntime, url: URL) => Promise<Response>) {
    const url = new URL(request.url)
    const key = new URL(url.pathname, url.origin)
    for (const name of params) {
      const value = url.searchParams.get(name)
      if (value !== null) key.searchParams.set(name, value)
    }
    const runtime = await load()
    const hit = runtime.cache ? await runtime.cache.match(new Request(key)).catch(() => undefined) : undefined
    if (hit) return conditional(request, hit)
    const response = await build(runtime, key)
    if (runtime.cache && response.status === 200) await runtime.cache.put(new Request(key), response.clone()).catch(() => undefined)
    return conditional(request, response)
  }
  return {
    async list(request: Request) {
      try {
        const query = listQuery(new URL(request.url))
        return await cached(request, listParams, async ({ catalogue, now }) => {
          const all = (await entries(catalogue, now())).filter(entry => query.include.has(entry.state))
          let start = 0
          if (query.cursor !== null) {
            const index = all.findIndex(entry => entry.video.legacyId === query.cursor)
            if (index < 0) throw new PublishedError(400, 'Unknown cursor; restart from the first page')
            start = index + 1
          }
          const page = all.slice(start, start + query.limit)
          const items = await Promise.all(page.map(entry => item(catalogue, entry)))
          const nextCursor = start + query.limit < all.length ? page.at(-1)!.video.legacyId : null
          return respond(PublishedVideoListV1.parse({ contractVersion: PUBLISHED_CONTRACT_VERSION, items, nextCursor, generatedAt: new Date(now()).toISOString() }), items, nextCursor)
        })
      } catch (error) { return fail(error) }
    },
    async get(request: Request, legacyId: string) {
      try {
        publishedLegacyId(legacyId)
        return await cached(request, [], async ({ catalogue, now }) => {
          const entry = (await entries(catalogue, now())).find(candidate => candidate.video.legacyId === legacyId)
          if (!entry) throw new PublishedError(404, 'Video not found')
          const video = await item(catalogue, entry)
          return respond(video, [video])
        })
      } catch (error) { return fail(error) }
    },
  }
}
