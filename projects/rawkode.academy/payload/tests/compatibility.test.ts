import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildClientSchema, findBreakingChanges, graphql, introspectionFromSchema, lexicographicSortSchema, parse, printSchema, validate } from 'graphql'
import type { Payload } from 'payload'
import { createCompatibilityContext, createCompatibilitySchema, createCompatibilityYoga } from '../src/compat'
import type { CatalogueDocument } from '../src/catalogue'

function harness() {
  const base = (id: number, legacyId: string, sourceOrder: number, data = {}): CatalogueDocument => ({ id, legacyId, sourceOrder, _status: 'published', tombstone: false, ...data })
  const records: Record<string, CatalogueDocument[]> = {
    videos: [
      base(13, 'future', 2, { title: 'Future Kubernetes', publishedAt: '2099-01-01T00:00:00Z', type: 'live', technologies: [31], guests: [21] }),
      base(12, 'newer', 1, { title: 'Newer video', description: 'Kubernetes systems', publishedAt: '2021-02-03T12:13:14Z', type: 'recorded', category: 'tutorial', technologies: [31], guests: [21], chapters: [42, 41], episode: 51 }),
      base(11, 'older', 0, { title: 'Older video', subtitle: 'KUBERNETES foundations', publishedAt: '2020-01-02T00:00:00Z', technologies: [31], guests: [21] }),
      base(14, 'draft', 3, { _status: 'draft', title: 'SECRET', publishedAt: '2020-01-01T00:00:00Z' }),
      base(15, 'deleted', 4, { tombstone: true, title: 'DELETED', publishedAt: '2020-01-01T00:00:00Z' }),
    ],
    people: [base(21, 'public-person', 0, { forename: 'Ada', surname: 'Lovelace', terms: [{ value: 'teacher' }], links: [{ name: 'Website', url: 'https://example.com' }] })],
    technologies: [base(31, 'kubernetes/index', 0, { name: 'Kubernetes', aliases: [{ value: 'k8s' }], learningResources: 71 }), base(32, 'other/index', 1, { name: 'Other' })],
    chapters: [base(41, 'chapter-1', 0, { startTime: 0, title: 'Start' }), base(42, 'chapter-2', 1, { startTime: 60, title: 'Next' })],
    shows: [base(61, 'show', 0, { name: 'Show', hosts: [21] })],
    episodes: [base(51, 'show-newer', 1, { code: 'S01E02', video: 12, show: 61 }), base(52, 'show-older', 0, { code: 'S01E01', video: 11, show: 61 })],
    'learning-resources': [base(71, 'resources', 0, { official: [{ url: 'https://kubernetes.io' }] })],
  }
  const calls: Record<string, unknown>[] = []
  const payload = { find: async (options: Record<string, unknown>) => {
    calls.push(options)
    assert.equal(options.overrideAccess, false)
    if (options.collection === 'video-publications') return { docs: [], hasNextPage: false }
    assert.equal(options.draft, false)
    assert.equal(options.user, null)
    assert.equal(options.depth, 0)
    assert.deepEqual(options.where, { and: [{ _status: { equals: 'published' } }, { tombstone: { not_equals: true } }] })
    return { docs: (records[String(options.collection)] ?? []).filter(document => document._status === 'published' && !document.tombstone), hasNextPage: false }
  } } as unknown as Payload
  const schema = createCompatibilitySchema(payload)
  const execute = (source: string) => graphql({ schema, source, contextValue: createCompatibilityContext(payload) })
  return { records, calls, payload, schema, execute }
}

test('schema exactly preserves dated gateway contract and validates representative operations', () => {
  const { schema } = harness()
  const baseline = buildClientSchema(JSON.parse(readFileSync(new URL('../fixtures/schema-gateway.json', import.meta.url), 'utf8')))
  assert.deepEqual(findBreakingChanges(baseline, schema), [])
  assert.equal(printSchema(lexicographicSortSchema(schema)), printSchema(lexicographicSortSchema(baseline)))
  assert.deepEqual(introspectionFromSchema(schema).__schema.directives, introspectionFromSchema(baseline).__schema.directives)
  assert.equal(schema.getMutationType() ?? null, null)
  const operations = parse(readFileSync(new URL('../fixtures/schema-operations.graphql', import.meta.url), 'utf8'))
  assert.deepEqual(validate(schema, operations), [])
})

test('legacy IDs, source ordering, date scalars, enums and arbitrary offset slices', async () => {
  const { execute } = harness()
  const result = await execute(`{ getAllVideos { id } getLatestVideos(limit:1,offset:1) { id } getTechnologies(limit:1,offset:1) { id } videoByID(id:"newer") { id publishedAt type category } }`)
  assert.equal(result.errors, undefined)
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
    getAllVideos: [{ id: 'older' }, { id: 'newer' }, { id: 'future' }],
    getLatestVideos: [{ id: 'older' }], getTechnologies: [{ id: 'other/index' }],
    videoByID: { id: 'newer', publishedAt: '2021-02-03', type: 'recorded', category: 'tutorial' },
  })
  const negative = await execute('{ getLatestVideos(limit:1,offset:-1) { id } getLatestZero:getLatestVideos(limit:0) { id } }')
  assert.equal(negative.errors, undefined)
  assert.deepEqual(JSON.parse(JSON.stringify(negative.data)), { getLatestVideos: [], getLatestZero: [] })
})

test('relationship traversal preserves array order and filters future reverse video links', async () => {
  const { execute, calls } = harness()
  const result = await execute(`{ videoByID(id:"newer") { chapters { title startTime } guests { id name links { name url } guestAppearances { id } hostedShows { id } } technologies { id aliases videos { id } learningResources { official } } episode { id show { id hosts { id } episodes { id } } video { id } } } }`)
  assert.equal(result.errors, undefined)
  const data = JSON.parse(JSON.stringify(result.data)).videoByID
  assert.deepEqual(data.chapters, [{ title: 'Next', startTime: 60 }, { title: 'Start', startTime: 0 }])
  assert.deepEqual(data.guests[0].guestAppearances, [{ id: 'older' }, { id: 'newer' }])
  assert.deepEqual(data.technologies[0].videos, [{ id: 'older' }, { id: 'newer' }])
  assert.deepEqual(data.technologies[0].aliases, ['k8s'])
  assert.deepEqual(data.technologies[0].learningResources.official, ['https://kubernetes.io'])
  assert.deepEqual(data.episode.show.episodes, [{ id: 'show-older' }, { id: 'show-newer' }])
  assert.equal(data.guests[0].name, 'Ada Lovelace')
  assert.equal(new Set(calls.map(call => call.collection)).size, calls.length, 'one find per collection per request')
})

test('search and random use only date-published catalogue; episode code is case-insensitive', async () => {
  const { execute } = harness()
  const result = await execute(`{ simpleSearch(term:"kUbErNeTeS") { id } getRandomVideos(limit:10) { id } episodeByShowCode(showId:"show",code:"s01e02") { id } episodeByVideoId(videoId:"older") { id } episodesForShow(showId:"show") { id } }`)
  assert.equal(result.errors, undefined)
  const data = JSON.parse(JSON.stringify(result.data))
  assert.deepEqual(data.simpleSearch, [{ id: 'newer' }, { id: 'older' }])
  assert.deepEqual(data.getRandomVideos.map((video: { id: string }) => video.id).sort(), ['newer', 'older'])
  assert.deepEqual(data.episodeByShowCode, { id: 'show-newer' })
  assert.deepEqual(data.episodeByVideoId, { id: 'show-older' })
  assert.deepEqual(data.episodesForShow, [{ id: 'show-older' }, { id: 'show-newer' }])
})

test('missing and protected records return nullable roots with no private relationship leakage', async () => {
  const { execute, records } = harness()
  records.people[0]._status = 'draft'
  const result = await execute(`{ missing:videoByID(id:"missing") { id } draft:videoByID(id:"draft") { id } deleted:videoByID(id:"deleted") { id } showById(id:"missing") { id } episodesForShow(showId:"missing") { id } videoByID(id:"newer") { guests { id } } }`)
  assert.equal(result.errors, undefined)
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), { missing: null, draft: null, deleted: null, showById: null, episodesForShow: [], videoByID: { guests: [] } })
})

test('unsupported external domains fail explicitly without fabricating state', async () => {
  const { execute } = harness()
  const result = await execute(`{ getTopEmojiReactions { emoji } videoByID(id:"newer") { id emojiReactions { emoji } hasReacted(emoji:"x",personId:"arbitrary") } me { id } }`)
  assert.equal(result.errors?.length, 3)
  for (const error of result.errors ?? []) assert.equal(error.extensions.code, 'DOMAIN_NOT_IMPLEMENTED')
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), { getTopEmojiReactions: null, videoByID: { id: 'newer', emojiReactions: null, hasReacted: null }, me: null })
})

test('HTTP facade ignores spoofed identity headers and has no mutation root', async () => {
  const { payload } = harness()
  const yoga = createCompatibilityYoga(payload)
  const request = new Request('http://localhost/graphql', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Gateway-User-Id': 'admin', 'X-Gateway-User-Username': 'rawkode' }, body: JSON.stringify({ query: '{ me { id } }' }) })
  const response = await yoga.fetch(request)
  assert.deepEqual(await response.json(), { data: { me: null } })
  const mutation = await yoga.fetch(new Request('http://localhost/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'mutation { deleteVideos(id: 1) { id } }' }) }))
  const result = await mutation.json() as { errors?: unknown[] }
  assert.ok(result.errors?.length)
})
