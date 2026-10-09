import assert from 'node:assert/strict'
import test from 'node:test'
import type { Payload } from 'payload'
import { Catalogue, type CatalogueDocument } from '../src/catalogue'
import type { TimesRow } from '../src/editorial/effective'
import { availability, liveStaleMs, PublishedVideoListV1, PublishedVideoV1 } from '../src/published/contract'
import { createPublishedHandlers } from '../src/published/http'
import { authConfig } from '../src/auth/config'
import { REVIEW_BRIDGE_ROUTES, serveBridge, serveDirect, servePublished } from '../src/ingress'
import { reviewRoutes } from '../../website/review/bridge'

const now = Date.parse('2026-10-09T12:00:00.000Z')
const iso = (hours: number) => new Date(now + hours * 3600000).toISOString()
const none = { scheduledStartAt: null, broadcastStartedAt: null, broadcastEndedAt: null, publishedAt: null }

test('availability: live, then available, then ended, then upcoming for live videos only', () => {
  assert.equal(availability('recorded', { ...none, publishedAt: iso(0) }, now), 'available', 'publishedAt == now is available')
  assert.equal(availability('recorded', { ...none, publishedAt: iso(1) }, now), null, 'a future recorded video is hidden')
  assert.equal(availability('live', { ...none, scheduledStartAt: iso(2) }, now), 'upcoming')
  assert.equal(availability('recorded', { ...none, scheduledStartAt: iso(2) }, now), null, 'upcoming is for live videos only')
  assert.equal(availability('live', { ...none, scheduledStartAt: iso(-1), broadcastStartedAt: iso(-1) }, now), 'live')
  assert.equal(availability('live', { ...none, broadcastStartedAt: new Date(now - liveStaleMs).toISOString() }, now), 'live', 'at the cap')
  assert.equal(availability('live', { ...none, broadcastStartedAt: new Date(now - liveStaleMs - 1).toISOString() }, now), 'ended', 'a missed end stops being live')
  assert.equal(availability('live', { ...none, broadcastStartedAt: iso(-2), broadcastEndedAt: iso(-1) }, now), 'ended')
  assert.equal(availability('live', { ...none, broadcastStartedAt: iso(-2), broadcastEndedAt: iso(-1), publishedAt: iso(-0.5) }, now), 'available')
  assert.equal(availability('live', { ...none, broadcastStartedAt: iso(-2), publishedAt: iso(-48) }, now), 'live', 'live beats an earlier release')
})

function fixture() {
  const base = (id: number, legacyId: string, data = {}): CatalogueDocument => ({ id, legacyId, slug: legacyId, sourceOrder: id, _status: 'published', tombstone: false, title: legacyId, description: `${legacyId} description`, ...data })
  const records: Record<string, CatalogueDocument[]> = {
    videos: [
      base(1, 'released', { type: 'recorded', category: 'tutorial', publishedAt: '2021-02-03T12:13:14.000Z', duration: 600, streamUrl: 'https://content.rawkode.academy/videos/released/stream.m3u8', thumbnailUrl: '/relative.jpg', technologies: [31], guests: [21], chapters: [41], show: 61, tagline: 'Tagline', subtitle: '' }),
      base(2, 'future-recorded', { type: 'recorded', publishedAt: iso(24) }),
      base(3, 'future-live', { type: 'live', publishedAt: iso(24) }),
      base(4, 'on-air', { type: 'live' }),
      base(5, 'draft', { _status: 'draft', type: 'recorded', publishedAt: iso(-24) }),
      base(6, 'deleted', { tombstone: true, type: 'recorded', publishedAt: iso(-24) }),
      base(7, 'reviewed', { type: 'recorded', publishedAt: iso(-1), reviewChapters: [{ title: 'Review start', startTime: 0, legacyId: 'x' }] }),
    ],
    people: [base(21, 'ada', { name: undefined, forename: 'Ada', surname: 'Lovelace' })],
    technologies: [base(31, 'kubernetes')],
    chapters: [base(41, 'chapter', { title: 'Start', startTime: 5 })],
    shows: [base(61, 'show', { name: 'Show' })],
    episodes: [base(51, 'show-1', { code: 'S01E01', video: 1, show: 61 })],
  }
  const times: TimesRow[] = [{ id: 4, scheduled_start_at: iso(-1), broadcast_started_at: iso(-0.5), broadcast_ended_at: null, published_at: null, version: 2, source: 'studio' }]
  const calls = { find: 0 }
  const payload = {
    auth: async () => { throw new Error('payload.auth must never run') },
    find: async (options: { collection: string; where?: unknown }) => {
      calls.find++
      if (options.collection === 'video-publications') return { docs: [], hasNextPage: false }
      return { docs: (records[options.collection] ?? []).filter(doc => doc._status === 'published' && !doc.tombstone), hasNextPage: false }
    },
  } as unknown as Payload
  const db = { prepare: () => ({ bind: (ids: string) => ({ all: async () => ({ results: times.filter(row => (JSON.parse(ids) as number[]).includes(row.id)) }) }) }) } as unknown as D1Database
  let clock = now
  const store = new Map<string, Response>()
  const cache = {
    async match(request: Request) { return store.get(request.url)?.clone() },
    async put(request: Request, response: Response) { store.set(request.url, response) },
  } as unknown as Cache
  const handlers = (withCache = false) => createPublishedHandlers(async () => ({ catalogue: new Catalogue(payload, db), now: () => clock, ...(withCache ? { cache } : {}) }))
  return { handlers, calls, store, tick: (ms: number) => { clock += ms } }
}
const list = (query = '', headers: Record<string, string> = {}) => new Request(`https://payload.internal/api/published/v1/videos${query}`, { headers })

test('the list returns only visible published videos, validated against the v1 contract', async () => {
  const { handlers } = fixture()
  const response = await handlers().list(list())
  assert.equal(response.status, 200)
  const body = PublishedVideoListV1.parse(await response.json())
  assert.deepEqual(body.items.map(item => [item.id, item.availability]), [['reviewed', 'available'], ['released', 'available']], 'drafts, tombstones and future recorded videos never appear')
  assert.equal(response.headers.get('cache-control'), 'public, max-age=30, s-maxage=30')
  const released = body.items.find(item => item.id === 'released')!
  assert.deepEqual(released, PublishedVideoV1.parse({
    contractVersion: 1, id: 'released', slug: 'released', title: 'released', description: 'released description', tagline: 'Tagline',
    type: 'recorded', category: 'tutorial', scheduledStartAt: null, broadcastStartedAt: null, broadcastEndedAt: null, publishedAt: '2021-02-03T12:13:14.000Z',
    availability: 'available', duration: 600, streamUrl: 'https://content.rawkode.academy/videos/released/stream.m3u8', thumbnailUrl: null,
    chapters: [{ title: 'Start', startTime: 5 }], show: { id: 'show', name: 'Show' }, guests: [{ id: 'ada', name: 'Ada Lovelace' }], technologies: ['kubernetes'],
    episode: { id: 'show-1', code: 'S01E01' }, youtubeId: null,
  }))
  assert.deepEqual(body.items.find(item => item.id === 'reviewed')!.chapters, [{ title: 'Review start', startTime: 0 }], 'review chapters win')

  const all = PublishedVideoListV1.parse(await (await handlers().list(list('?include=upcoming,live,ended'))).json())
  assert.deepEqual(all.items.map(item => [item.id, item.availability]), [['on-air', 'live'], ['future-live', 'upcoming'], ['reviewed', 'available'], ['released', 'available']])
  assert.equal(all.items[1].scheduledStartAt, iso(24), 'a live video falls back to its imported publishedAt as the schedule')
  assert.equal(all.items[0].broadcastStartedAt, iso(-0.5))
  const live = await handlers().list(list('?include=live'))
  assert.equal(live.headers.get('cache-control'), 'public, max-age=15, s-maxage=15')
})

test('pagination, query validation and the single-video read', async () => {
  const { handlers } = fixture()
  const first = PublishedVideoListV1.parse(await (await handlers().list(list('?limit=1'))).json())
  assert.equal(first.nextCursor, 'reviewed')
  const second = PublishedVideoListV1.parse(await (await handlers().list(list(`?limit=1&cursor=${first.nextCursor}`))).json())
  assert.deepEqual(second.items.map(item => item.id), ['released'])
  assert.equal(second.nextCursor, null)
  for (const query of ['?limit=0', '?limit=101', '?include=available,drafts', '?cursor=../x', '?cursor=unknown']) assert.equal((await handlers().list(list(query))).status, 400, query)
  const one = await handlers().get(new Request('https://payload.internal/api/published/v1/videos/on-air'), 'on-air')
  assert.equal(one.status, 200)
  assert.equal(PublishedVideoV1.parse(await one.json()).availability, 'live')
  assert.equal(one.headers.get('cache-control'), 'public, max-age=15, s-maxage=15')
  assert.equal((await handlers().get(new Request('https://payload.internal/api/published/v1/videos/draft'), 'draft')).status, 404)
  assert.equal((await handlers().get(new Request('https://payload.internal/api/published/v1/videos/future-recorded'), 'future-recorded')).status, 404)
  assert.equal((await handlers().get(new Request('https://payload.internal/x'), 'bad id!')).status, 400)
})

test('ETags ignore generatedAt, revalidate with 304, and requests are anonymous and cached', async () => {
  const { handlers, calls, store, tick } = fixture()
  const a = await handlers().list(list())
  tick(1000)
  const b = await handlers().list(list('', { cookie: '__Host-poc-oidc-session=staff', authorization: 'Bearer x' }))
  const [bodyA, bodyB] = [await a.json(), await b.json()] as { generatedAt: string; items: unknown[] }[]
  assert.notEqual(bodyA.generatedAt, bodyB.generatedAt)
  assert.deepEqual(bodyA.items, bodyB.items, 'credentials change nothing')
  assert.equal(a.headers.get('etag'), b.headers.get('etag'))
  const revalidated = await handlers().list(list('', { 'if-none-match': a.headers.get('etag')! }))
  assert.equal(revalidated.status, 304)
  assert.equal(await revalidated.text(), '')

  const cached = handlers(true)
  const first = await cached.list(list('?include=live&utm=ignored'))
  const findsAfterFirst = calls.find
  const second = await cached.list(list('?include=live&utm=other', { cookie: 'a=b' }))
  assert.equal(calls.find, findsAfterFirst, 'the second request is served from the Workers cache')
  assert.equal(await first.text(), await second.text())
  assert.deepEqual([...store.keys()], ['https://payload.internal/api/published/v1/videos?include=live'], 'the key keeps only known query parameters')
  assert.equal((await cached.list(list('?include=live', { 'if-none-match': second.headers.get('etag')! }))).status, 304)
})

test('the published contract is reachable only through the PublishedContent entrypoint', async () => {
  const ADMIN = 'https://admin.rawkode.academy', PREVIEW = 'https://preview.rawkode.academy'
  const prod = authConfig({ OIDC_DIRECT_ORIGINS: JSON.stringify([ADMIN]), OIDC_BRIDGE_ORIGINS: JSON.stringify([PREVIEW]), REVIEW_PUBLIC_MEDIA_ORIGIN: ADMIN })
  const seen: Request[] = []
  const next = async (request: Request) => { seen.push(request); return new Response('downstream') }
  for (const path of ['/api/published/v1/videos', '/api/published/v1/videos/released', '/api//published/v1/videos', '/api/%70ublished/v1/videos', '/API/Published/v1/videos', '/api/published']) {
    assert.equal((await serveDirect(new Request(ADMIN + path), prod, next)).status, 404, path)
    assert.equal((await serveBridge(new Request(PREVIEW + path), prod, next)).status, 404, path)
  }
  for (const path of ['/api/published/v1/videos', '/api/editorial/times', '/api/editorial/broadcast', '/api/review/queue', '/api/review/staff']) {
    assert.equal(path in REVIEW_BRIDGE_ROUTES, false, path)
    assert.equal(path in reviewRoutes, false, path)
  }
  assert.equal(seen.length, 0)
  const internal = await servePublished(new Request('https://payload.internal/api/published/v1/videos?include=live', { headers: { cookie: 'session=x', authorization: 'Bearer y', origin: ADMIN } }), next)
  assert.equal(internal.status, 200)
  assert.equal(seen[0].headers.get('cookie'), null)
  assert.equal(seen[0].headers.get('authorization'), null)
  assert.equal(new URL(seen[0].url).search, '?include=live')
  assert.equal((await servePublished(new Request('https://payload.internal/api/published/v1/videos/released'), next)).status, 200)
  for (const path of ['/admin', '/api/videos', '/api/published/v2/videos', '/api/published/v1/videos/a/b', '/api/graphql']) assert.equal((await servePublished(new Request(`https://payload.internal${path}`), next)).status, 404, path)
  assert.equal((await servePublished(new Request('https://payload.internal/api/published/v1/videos', { method: 'POST', body: '{}' }), next)).status, 405)
})
