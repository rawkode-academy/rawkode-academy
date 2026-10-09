import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import test, { type TestContext } from 'node:test'
import { sql, type MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import type { Payload } from 'payload'
import { graphql } from 'graphql'
import { createCompatibilitySchema, createCompatibilityContext } from '../src/compat'
import { migrations } from '../src/migrations'
import { ReviewService } from '../src/review/service'
import { ReviewStore } from '../src/review/store'
import { actorFromUser, type ReviewActor } from '../src/review/contracts'
import { reviewCollections } from '../src/review/collections'
import { noDevelopers } from '../src/admin/access'
import { createReviewHandlers } from '../src/review/http'
import { byteRange, mediaResponse } from '../src/review/media'
import { digestBytes, fixtureChecksum, verifiedDeliverable, stageReleaseObject } from '../src/review/artifacts'
import { Catalogue } from '../src/catalogue'
import { authConfig } from '../src/auth/config'
import { publishedMediaUrl } from '../src/review/host'

const staff: ReviewActor = { id: 1, collection: 'users', role: 'staff' }
const client: ReviewActor = { id: 2, collection: 'users', role: 'customer' }
const stranger: ReviewActor = { id: 3, collection: 'users', role: 'customer' }
const metadata = { title: 'Reviewed cut', description: 'Approved public summary', chapters: [{ title: 'Start', startTime: 0 }] }
const command = (action: string, data = {}) => ({ action, videoId: 10, commandId: crypto.randomUUID(), ...data })

async function harness(t: TestContext, publicMediaUrl = (videoId: number, publicationId: string) => `https://preview.example/api/review/published-media?videoId=${videoId}&publicationId=${publicationId}`) {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec('PRAGMA foreign_keys=ON')
  const migrationArgs = { db: { run(statement: ReturnType<typeof sql>) {
    const query = statement.toQuery({ casing: undefined as never, escapeName: value => `"${value}"`, escapeParam: () => '?', escapeString: value => `'${value.replaceAll("'", "''")}'` })
    assert.equal(query.params.length, 0)
    sqlite.exec(query.sql)
  } } } as unknown as MigrateUpArgs
  for (const migration of migrations) {
    sqlite.exec('BEGIN; PRAGMA defer_foreign_keys=ON')
    await migration.up(migrationArgs)
    sqlite.exec('COMMIT')
  }
  sqlite.exec(`INSERT INTO users(id,email,role) VALUES(1,'staff@example.invalid','staff'),(2,'client@example.invalid','customer'),(3,'stranger@example.invalid','customer');
    INSERT INTO videos(id,legacy_id,legacy_type,slug,title,_status) VALUES(10,'stable-video','Video','stable-video','Old title','draft'),(11,'other-video','Video','other-video','Other','draft');
    INSERT INTO media(id,filename) VALUES(20,'original.mp4'),(21,'deliverable.mp4'),(22,'second-cut.mp4');
    INSERT INTO _videos_v(id,parent_id,version_legacy_id,version__status,latest) VALUES(30,10,'stable-video','draft',1);
    INSERT INTO videos_terms(id,_order,_parent_id,value) VALUES('term',1,10,'old');
    INSERT INTO _videos_v_version_terms(id,_order,_parent_id,value) VALUES(31,1,30,'old');
    INSERT INTO videos_rels(id,parent_id,path) VALUES(32,10,'guests');
    INSERT INTO _videos_v_rels(id,parent_id,path) VALUES(33,30,'version.guests');
    INSERT INTO videos_what_you_will_learn(id,_order,_parent_id,value) VALUES('learn',1,10,'old');
    INSERT INTO _videos_v_version_what_you_will_learn(id,_order,_parent_id,value) VALUES(34,1,30,'old');`)
  let failAfter = -1
  class Prepared {
    values: (string | number | null)[] = []
    constructor(readonly query: string) {}
    bind(...values: (string | number | null)[]) { this.values = values; return this }
    async first() { return sqlite.prepare(this.query).get(...this.values) ?? null }
    async all() { return { results: sqlite.prepare(this.query).all(...this.values) } }
  }
  const db = {
    prepare: (query: string) => new Prepared(query),
    async batch(statements: Prepared[]) {
      sqlite.exec('BEGIN')
      try {
        for (const [index, statement] of statements.entries()) {
          sqlite.prepare(statement.query).run(...statement.values)
          if (index === failAfter) throw new Error('Injected database failure')
        }
        sqlite.exec('COMMIT'); return []
      } catch (error) { sqlite.exec('ROLLBACK'); throw error }
    },
  } as unknown as D1Database
  const store = new ReviewStore(db)
  const sources = new Map([[20, 'a'.repeat(64)], [21, 'b'.repeat(64)], [22, 'c'.repeat(64)]])
  let sourceWait: (() => Promise<void>) | undefined
  const service = new ReviewService(store, {
    async video(id) {
      const row = sqlite.prepare('SELECT * FROM videos WHERE id=?').get(id)
      if (!row) throw new Error('missing video')
      return { id, legacyId: String(row.legacy_id), slug: 'stable-video', type: 'recorded', title: 'Old title', streamUrl: 'https://wrong.invalid/old.m3u8', sourceData: { private: true }, sourceOrder: 0 }
    },
    async source(id) { await sourceWait?.(); return { checksum: sources.get(id)! } },
    async deliverable(id) { return { checksum: sources.get(id)!, durationMs: 60000, contentType: 'video/mp4' } },
    async stageRelease(videoId, publicationId, mediaId, checksum) { return { key: `review-releases/${videoId}/${publicationId}/${checksum}.mp4`, etag: 'release-etag', checksum: sources.get(mediaId)!, bytes: 10, contentType: 'video/mp4' } },
    publicMediaUrl,
  })
  async function prepare() {
    const revision = await service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 21, durationMs: 60000, metadata }))
    await service.execute(staff, command('grant', { userId: 2, canApprove: true }))
    return revision as { revisionId: string; reviewVersion: number }
  }
  async function approve(revision: { revisionId: string; reviewVersion: number }) {
    return service.execute(client, command('decide', { revisionId: revision.revisionId, expectedReviewVersion: revision.reviewVersion, decision: 'approved' }))
  }
  return { sqlite, migrationArgs, db, store, service, prepare, approve, sources, fail: (index: number) => { failAfter = index }, pauseSource: (fn?: () => Promise<void>) => { sourceWait = fn } }
}

test('client review, immutable cuts, explicit approval and separate atomic staff publication', async t => {
  const h = await harness(t), revision = await h.prepare()
  await assert.rejects(h.service.read(10, stranger), { status: 404 })
  await assert.rejects(h.service.execute(client, command('publish', { revisionId: revision.revisionId, expectedReviewVersion: 1, decisionId: crypto.randomUUID() })), { status: 403 })
  const comment = command('comment', { revisionId: revision.revisionId, startMs: 12000, body: '<script>plain text</script>' })
  const saved = await h.service.execute(client, comment)
  assert.deepEqual(await h.service.execute(client, comment), saved)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_comments').get()?.n, 1)
  await h.service.execute(client, command('resolve-comment', { commentId: saved.commentId, resolved: true }))
  await h.service.execute(client, command('resolve-comment', { commentId: saved.commentId, resolved: false }))
  await h.service.execute(staff, command('resolve-comment', { commentId: saved.commentId, resolved: true }))
  const decision = await h.approve(revision)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM video_publications').get()?.n, 0, 'client approval stays private')
  const publish = command('publish', { revisionId: revision.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId })
  const published = await h.service.execute(staff, publish)
  assert.deepEqual(await h.service.execute(staff, publish), published)
  for (const action of [command('edit', { revisionId: revision.revisionId, expectedReviewVersion: 1, metadata }), command('decide', { revisionId: revision.revisionId, expectedReviewVersion: 1, decision: 'changes-requested' })]) await assert.rejects(h.service.execute(action.action === 'edit' ? staff : client, action), { status: 409 })
  assert.throws(() => h.sqlite.exec("UPDATE review_decisions SET decision='changes-requested'"), /immutable/)
  assert.throws(() => h.sqlite.exec("UPDATE video_revisions SET metadata='{}'"), /immutable/)
  assert.throws(() => h.sqlite.exec("DELETE FROM review_publication_events"), /immutable/)
  const projection = JSON.parse(String(h.sqlite.prepare('SELECT document FROM video_publications').get()?.document))
  assert.equal(projection.id, 10); assert.equal(projection.legacyId, 'stable-video')
  assert.equal(projection.title, metadata.title); assert.ok(projection.publishedAt)
  const cataloguePayload = { find: async ({ collection }: { collection: string }) => ({ docs: collection === 'video-publications' ? [{ id: 10, document: projection }] : [], hasNextPage: false }) } as unknown as Payload
  const result = await graphql({ schema: createCompatibilitySchema(cataloguePayload), contextValue: createCompatibilityContext(cataloguePayload), source: '{videoByID(id:"stable-video"){id title duration streamUrl chapters{title startTime}}}' })
  assert.equal(result.errors, undefined)
  assert.equal((result.data?.videoByID as any).duration, 60)
  assert.deepEqual(JSON.parse(JSON.stringify((result.data?.videoByID as any).chapters)), metadata.chapters)
  assert.match(projection.streamUrl, /published-media/); assert.equal(projection.sourceData, undefined)
  const read = await h.service.read(10, client)
  assert.equal(read.resolutions.length, 3)
  assert.deepEqual(read.resolutions.map((event: any) => event.actorId).sort(), [1, 2, 2])
  assert.ok(read.resolutions.every((event: any) => event.createdAt))
  assert.equal(read.comments.length, 1); assert.equal(read.revisions[0].metadata.title, metadata.title)
  assert.equal(JSON.stringify(read).includes('checksum'), false)
  assert.equal(JSON.stringify(read).includes('original.mp4'), false)
  const next = await h.service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 22, durationMs: 60000, metadata: { ...metadata, title: 'Next cut' } }))
  assert.notEqual(next.revisionId, revision.revisionId)
  assert.equal((await h.service.read(10, client)).comments.length, 1)
  assert.equal(JSON.parse(String(h.sqlite.prepare('SELECT document FROM video_publications').get()?.document)).title, metadata.title)
  assert.deepEqual(h.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

test('approval freezes revisions and grant changes cannot resurrect an old decision', async t => {
  const h = await harness(t), revision = await h.prepare()
  await h.service.execute(staff, command('edit', { revisionId: revision.revisionId, expectedReviewVersion: 1, metadata: { ...metadata, description: 'Changed' } }))
  await assert.rejects(h.approve(revision), { status: 409 })
  const revised = { ...revision, reviewVersion: 2 }, approved = await h.approve(revised)
  await assert.rejects(h.service.execute(staff, command('edit', { revisionId: revision.revisionId, expectedReviewVersion: 2, metadata })), { status: 409 })
  await assert.rejects(h.service.execute(client, command('decide', { revisionId: revision.revisionId, expectedReviewVersion: 2, decision: 'changes-requested' })), { status: 409 })
  await h.service.execute(staff, command('revoke', { userId: 2 }))
  await assert.rejects(h.service.read(10, client), { status: 404 })
  await h.service.execute(staff, command('grant', { userId: 2, canApprove: true }))
  await assert.rejects(h.service.execute(staff, command('publish', { revisionId: revision.revisionId, expectedReviewVersion: 2, decisionId: approved.decisionId })), { status: 409 })
  assert.equal((await h.service.read(10, client)).revisions[0].state, 'approved')
  const next = await h.service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 22, durationMs: 60000, metadata }))
  await h.service.execute(client, command('decide', { revisionId: next.revisionId, expectedReviewVersion: 1, decision: 'changes-requested', note: 'Fix the example' }))
  assert.equal((await h.service.revision(10, next.revisionId, client)).state, 'changes-requested')
})

test('timestamp, chapter, identity, command ownership and cross-video validation fail closed', async t => {
  const h = await harness(t), revision = await h.prepare()
  for (const user of [null, { ...client, collection: 'other' }, { ...client, id: '2' }]) assert.throws(() => actorFromUser(user), { status: 401 })
  for (const times of [{ startMs: -1 }, { startMs: 60000 }, { startMs: 10, endMs: 9 }, { startMs: 10, endMs: 60001 }, { startMs: 1.2 }]) await assert.rejects(h.service.execute(client, command('comment', { revisionId: revision.revisionId, body: 'x', ...times })), { status: 400 })
  await assert.rejects(h.service.execute(staff, command('edit', { revisionId: revision.revisionId, expectedReviewVersion: 1, metadata: { ...metadata, chapters: [{ title: 'Bad', startTime: 60 }] } })), { status: 400 })
  await assert.rejects(h.service.execute(client, command('comment', { videoId: 11, revisionId: revision.revisionId, startMs: 0, body: 'x' })), { status: 404 })
  const request = command('comment', { revisionId: revision.revisionId, startMs: 0, body: 'x' })
  await h.service.execute(client, request)
  await assert.rejects(h.service.execute(staff, request), { status: 409 })
  await assert.rejects(h.service.execute(client, { ...request, body: 'different' }), { status: 409 })
  await assert.rejects(h.service.execute(client, { ...request, authorId: 1 }), { status: 400 })
  await assert.rejects(h.service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 21, durationMs: 123, metadata })), { status: 400 })
  await assert.rejects(h.service.execute(staff, command('edit', { revisionId: revision.revisionId, expectedReviewVersion: 1, metadata: { ...metadata, chapters: [{ title: 'Fractional', startTime: 0.5 }] } })), { status: 400 })
  await h.service.execute(staff, command('revoke', { userId: 2 }))
  await assert.rejects(h.service.execute(client, request), { status: 404 }, 'revoked users cannot replay saved results')
})

test('publish loses concurrent edit or revocation, and two edits cannot both use one review version', async t => {
  const h = await harness(t), revision = await h.prepare(), decision = await h.approve(revision)
  let release!: () => void, entered!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { entered = resolve })
  h.pauseSource(async () => { entered(); await waiting })
  const publishing = h.service.execute(staff, command('publish', { revisionId: revision.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId }))
  await started
  await h.service.execute(staff, command('revoke', { userId: 2 }))
  release()
  await assert.rejects(publishing, { status: 409 })
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM video_publications').get()?.n, 0)
  h.pauseSource()
  const fresh = await h.service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 22, durationMs: 60000, metadata }))
  const edit = () => h.service.execute(staff, command('edit', { revisionId: fresh.revisionId, expectedReviewVersion: 1, metadata }))
  const edits = await Promise.allSettled([edit(), edit()])
  assert.equal(edits.filter(result => result.status === 'fulfilled').length, 1)
})

test('failed batch rolls back generation, comment, journal and guard; exact retry succeeds', async t => {
  const h = await harness(t), revision = await h.prepare()
  const request = command('comment', { revisionId: revision.revisionId, startMs: 0, body: 'Retry me' })
  const generation = h.sqlite.prepare('SELECT generation FROM video_review_state').get()?.generation
  h.fail(3)
  await assert.rejects(h.service.execute(client, request), /Injected/)
  assert.equal(h.sqlite.prepare('SELECT generation FROM video_review_state').get()?.generation, generation)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_comments').get()?.n, 0)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_command_guards').get()?.n, 0)
  h.fail(-1)
  await h.service.execute(client, request)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_comments').get()?.n, 1)
})

test('changed original or deliverable bytes cannot be published', async t => {
  const h = await harness(t), revision = await h.prepare(), decision = await h.approve(revision)
  for (const mediaId of [20, 21]) {
    const original = h.sources.get(mediaId)!
    h.sources.set(mediaId, 'changed')
    await assert.rejects(h.service.execute(staff, command('publish', { revisionId: revision.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId })), { status: 409 })
    h.sources.set(mediaId, original)
  }
})

test('managed video, versions, relationships and arrays resist legacy writes and destructive rollback', async t => {
  const h = await harness(t)
  await h.prepare()
  const tables = ['videos','_videos_v','videos_terms','_videos_v_version_terms','videos_rels','_videos_v_rels','videos_what_you_will_learn','_videos_v_version_what_you_will_learn']
  const before = tables.map(table => h.sqlite.prepare(`SELECT * FROM ${table}`).all())
  for (const table of tables) {
    assert.throws(() => h.sqlite.exec(`DELETE FROM ${table}`), /Managed video/)
    assert.throws(() => h.sqlite.exec(`UPDATE ${table} SET id=id`), /Managed video/)
  }
  assert.throws(() => h.sqlite.exec("INSERT INTO pipeline_runs(id,key,video_id,media_id,state) VALUES(1,'bypass',10,20,'registered')"), /Managed video/)
  assert.deepEqual(tables.map(table => h.sqlite.prepare(`SELECT * FROM ${table}`).all()), before)
  await assert.rejects(migrations.find(m => m.name === '20261005_120000_video_review')!.down(h.migrationArgs), /CHECK constraint/)
  assert.equal((await h.service.read(10, client)).revisions.length, 1)
})

test('migration matches snapshot indexes, empty downgrade works, and legacy pipeline cannot enroll', async t => {
  const h = await harness(t)
  const snapshot = JSON.parse(await readFile(new URL('../src/migrations/20261005_120000_video_review.json', import.meta.url), 'utf8')) as {
    tables: Record<string, { indexes: Record<string, { name: string; columns: string[]; isUnique: boolean }> }>
  }
  for (const collection of reviewCollections(noDevelopers)) {
    const table = collection.slug.replaceAll('-', '_')
    const expected = Object.values(snapshot.tables[table].indexes).sort((a, b) => a.name.localeCompare(b.name))
    const actual = h.sqlite.prepare(`SELECT name, "unique" AS is_unique FROM pragma_index_list(?) WHERE origin='c'`).all(table).map(index => ({
      name: String(index.name),
      columns: h.sqlite.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(String(index.name)).map(column => String(column.name)),
      isUnique: Boolean(index.is_unique),
    })).sort((a, b) => a.name.localeCompare(b.name))
    assert.deepEqual(actual, expected, `${table} indexes must match the generated schema snapshot`)
  }
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM video_review_state').get()?.n, 0)
  h.sqlite.exec("INSERT INTO pipeline_runs(id,key,video_id,media_id,state) VALUES(1,'legacy',10,20,'registered')")
  await assert.rejects(h.prepare(), { status: 409 })
  await migrations.find(m => m.name === '20261005_120000_video_review')!.down(h.migrationArgs)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM videos').get()?.n, 2)
})

test('unresolved comments block publication, and a failed publication batch leaves no public record', async t => {
  const h = await harness(t), revision = await h.prepare(), decision = await h.approve(revision)
  const comment = await h.service.execute(client, command('comment', { revisionId: revision.revisionId, startMs: 0, body: 'Must fix before release' }))
  const publish = command('publish', { revisionId: revision.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId })
  await assert.rejects(h.service.execute(staff, publish), { status: 409 })
  await h.service.execute(client, command('resolve-comment', { commentId: comment.commentId, resolved: true }))
  for (const boundary of [2,3,4,5]) {
    h.fail(boundary)
    await assert.rejects(h.service.execute(staff, publish), /Injected/)
    assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM video_publications').get()?.n, 0)
    assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_publication_events').get()?.n, 0)
    assert.equal((await h.service.revision(10, revision.revisionId, client)).state, 'approved')
  }
  h.fail(-1)
  await h.service.execute(staff, publish)
  const release = h.sqlite.prepare('SELECT * FROM review_publication_events').get()!
  assert.match(String(release.object_key), /^review-releases\//)
  assert.equal(release.checksum, 'b'.repeat(64))
  assert.equal(release.object_etag, 'release-etag')
  assert.throws(() => h.sqlite.exec("UPDATE review_comment_resolutions SET actor_id=3"), /immutable/)
})

test('Payload review collections deny generic mutations and customer raw reads', async () => {
  for (const collection of reviewCollections(noDevelopers)) {
    for (const action of ['create','update','delete'] as const) assert.equal(await collection.access![action]!({ req: { user: staff } } as never), false)
    assert.equal(await collection.access!.read!({ req: { user: client } } as never), collection.slug === 'video-publications')
  }
})

test('assigned clients resolve only their own comments, staff resolve any, revoked clients resolve none', async t => {
  const h = await harness(t), revision = await h.prepare()
  await h.service.execute(staff, command('grant', { userId: 3, canApprove: false }))
  const own = await h.service.execute(client, command('comment', { revisionId: revision.revisionId, startMs: 0, body: 'Client comment' }))
  const other = await h.service.execute(stranger, command('comment', { revisionId: revision.revisionId, startMs: 0, body: 'Other client comment' }))
  await h.service.execute(client, command('resolve-comment', { commentId: own.commentId, resolved: true }))
  await assert.rejects(h.service.execute(client, command('resolve-comment', { commentId: other.commentId, resolved: true })), { status: 403 })
  await h.service.execute(staff, command('resolve-comment', { commentId: other.commentId, resolved: true }))
  await h.service.execute(staff, command('revoke', { userId: 2 }))
  await assert.rejects(h.service.execute(client, command('resolve-comment', { commentId: own.commentId, resolved: false })), { status: 404 })
})

test('HTTP commands enforce origin, JSON size/type, validation and private cache policy', async t => {
  const h = await harness(t); await h.prepare()
  const handlers = createReviewHandlers(async () => ({ service: h.service, actor: client, origin: 'https://preview.example' }))
  const request = (headers: Record<string,string>, body = '{}') => new Request('https://preview.example/api/review', { method: 'POST', headers, body })
  assert.equal((await handlers.POST(request({ origin: 'https://evil.example', 'content-type': 'application/json' }))).status, 403)
  assert.equal((await handlers.POST(request({ origin: 'https://preview.example' }))).status, 415)
  const headers = { origin: 'https://preview.example', 'content-type': 'application/json' }
  assert.equal((await handlers.POST(request(headers, 'broken'))).status, 400)
  assert.equal((await handlers.POST(request(headers, 'x'.repeat(262145)))).status, 413)
  const response = await handlers.GET(new Request('https://preview.example/api/review?videoId=10'))
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store')
})

test('private playback supports bounded ranges and prevents public caching', async () => {
  assert.deepEqual(byteRange('bytes=2-5', 10), { offset: 2, length: 4 })
  assert.deepEqual(byteRange('bytes=-3', 10), { offset: 7, length: 3 })
  for (const header of ['bytes=11-', 'bytes=5-2', 'bytes=1-2,4-5', 'bytes=-0']) assert.throws(() => byteRange(header, 10), { status: 416 })
  const bucket = { head: async () => ({ size: 10, etag: 'etag', httpEtag: '"etag"', httpMetadata: { contentType: 'video/mp4' } }), get: async () => ({ body: '2345' }) } as unknown as R2Bucket
  const response = await mediaResponse(new Request('https://preview.example/media', { headers: { range: 'bytes=2-5' } }), bucket, 'private.mp4')
  assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), 'bytes 2-5/10')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(await response.text(), '2345')
})

test('Catalogue overlays committed publications and preserves the stable video ID', async () => {
  const published = { id: 10, legacyId: 'stable', title: 'Approved cut', _status: 'published', sourceOrder: 1 }
  const payload = { find: async ({ collection }: { collection: string }) => ({ docs: collection === 'video-publications' ? [{ id: 10, document: published }] : [{ ...published, title: 'Old public cut' }], hasNextPage: false }) } as unknown as Payload
  const view = new Catalogue(payload)
  assert.deepEqual(await view.all('videos'), [published])
})


test('only explicitly enabled known local fixture bytes pass the trusted deliverable gate', async () => {
  const bytes = new Uint8Array(await readFile(new URL('../fixtures/synthetic.mp4', import.meta.url))).buffer
  assert.equal(await digestBytes(bytes), fixtureChecksum)
  assert.deepEqual(verifiedDeliverable(fixtureChecksum, true, true), { checksum: fixtureChecksum, durationMs: 1000, contentType: 'video/mp4' })
  for (const args of [[fixtureChecksum, true, false], [fixtureChecksum, false, true], ['forged MIME and duration', true, true]] as const) assert.throws(() => verifiedDeliverable(args[0], args[1], args[2]), { status: 503 })
})

test('release staging never overwrites a key, and delivery rejects mutated release bytes', async () => {
  const bytes = new TextEncoder().encode('approved bytes').buffer, checksum = await digestBytes(bytes)
  let stored: ArrayBuffer | undefined
  let etag = 'v1'
  const bucket = {
    async put(_key: string, value: ArrayBuffer, options: R2PutOptions) { assert.equal(options.onlyIf && 'etagDoesNotMatch' in options.onlyIf && options.onlyIf.etagDoesNotMatch, '*'); if (stored) return null; stored = value; return { etag, size: stored.byteLength } },
    async head() { return stored ? { etag, httpEtag: etag, size: stored.byteLength } : null },
    async get() { return stored ? { body: new Blob([stored]).stream(), arrayBuffer: async () => stored } : null },
  } as unknown as R2Bucket
  const release = await stageReleaseObject(bucket, 'release.mp4', bytes, checksum, 'video/mp4')
  assert.deepEqual(await stageReleaseObject(bucket, 'release.mp4', bytes, checksum, 'video/mp4'), release)
  const response = await mediaResponse(new Request('https://preview.example/public'), bucket, release.key, true, release)
  assert.equal(await response.text(), 'approved bytes')
  stored = new TextEncoder().encode('different bytes').buffer; etag = 'v2'
  await assert.rejects(mediaResponse(new Request('https://preview.example/public'), bucket, release.key, true, release), { status: 409 })
  await assert.rejects(stageReleaseObject(bucket, 'release.mp4', bytes, checksum, 'video/mp4'), { status: 409 })
})


test('retry records the ETag of verified bytes even if the release changes immediately afterwards', async () => {
  const approved = new TextEncoder().encode('approved').buffer, checksum = await digestBytes(approved)
  let etag = 'approved-etag', headCalls = 0
  const bucket = {
    async put() { return null },
    async head() { headCalls++; return { etag, httpEtag: etag, size: approved.byteLength } },
    async get() { return { body: new Blob([approved]).stream(), arrayBuffer: async () => { etag = 'changed-etag'; return approved } } },
  } as unknown as R2Bucket
  const release = await stageReleaseObject(bucket, 'release.mp4', approved, checksum, 'video/mp4')
  assert.equal(headCalls, 1, 'no unverified second HEAD can replace the verified fingerprint')
  assert.equal(release.etag, 'approved-etag')
  await assert.rejects(mediaResponse(new Request('https://preview.example/public'), bucket, release.key, true, release), { status: 409 })
})


test('review list exposes only active customer grants and safe summary fields', async t => {
  const h = await harness(t); await h.prepare()
  await h.service.execute(staff, command('create-revision', { videoId: 11, mediaId: 20, deliverableMediaId: 21, metadata: { ...metadata, title: 'Other customer secret' } }))
  await h.service.execute(staff, command('grant', { videoId: 11, userId: 3, canApprove: true }))
  assert.deepEqual((await h.service.list(client)).items.map(item => item.videoId), [10])
  assert.deepEqual((await h.service.list(stranger)).items.map(item => item.videoId), [11])
  assert.deepEqual((await h.service.list(staff)).items.map(item => item.videoId), [10, 11])
  const handlers = createReviewHandlers(async () => ({ service: h.service, actor: client, origin: 'https://preview.rawkode.academy' }))
  const response = await handlers.GET(new Request('https://preview.rawkode.academy/api/review'))
  const listing = await response.json() as Awaited<ReturnType<ReviewService['list']>>
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(Object.keys(listing.items[0]).sort(), ['reviewVersion', 'revisionId', 'state', 'title', 'videoId'])
  assert.equal(JSON.stringify(listing).includes('Other customer secret'), false)
  assert.equal((await h.service.read(10, client)).canApprove, true)
  await h.service.execute(staff, command('grant', { userId: 2, canApprove: false }))
  assert.equal((await h.service.read(10, client)).canApprove, false)
  await h.service.execute(staff, command('revoke', { userId: 2 }))
  assert.deepEqual((await h.service.list(client)).items, [])
  assert.equal((await handlers.GET(new Request('https://preview.rawkode.academy/api/review?videoId=10'))).status, 404)
  for (const cursor of ['-1', '1.2', 'x', '9007199254740992']) assert.equal((await handlers.GET(new Request(`https://preview.rawkode.academy/api/review?after=${cursor}`))).status, 400)
})

test('review list paginates by stable video ID without skipping customer grants', async t => {
  const h = await harness(t)
  for (let id = 100; id < 151; id++) {
    h.sqlite.prepare('INSERT INTO videos(id,legacy_id,legacy_type,slug,title,_status) VALUES(?,?,?,?,?,?)').run(id, `video-${id}`, 'Video', `video-${id}`, 'Review', 'draft')
    await h.service.execute(staff, command('create-revision', { videoId: id, mediaId: 20, deliverableMediaId: 21, metadata }))
    await h.service.execute(staff, command('grant', { videoId: id, userId: 2, canApprove: false }))
  }
  const first = await h.service.list(client)
  assert.equal(first.items.length, 50); assert.equal(first.nextCursor, 149)
  const next = await h.service.list(client, first.nextCursor!)
  assert.deepEqual(next.items.map(item => item.videoId), [150]); assert.equal(next.nextCursor, null)
})


test('thumbnail snapshots remain video-owned, private and unchanged on older revisions', async t => {
  const h = await harness(t)
  h.service.dependencies.thumbnail = async (videoId, thumbnailId) => {
    if (videoId !== 10 || ![30, 31].includes(thumbnailId)) throw new Error('Thumbnail belongs to another video')
  }
  await assert.rejects(h.service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 21, metadata: { ...metadata, thumbnailId: 99 } })), /another video/)
  const first = await h.service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 21, metadata: { ...metadata, thumbnailId: 30 } }))
  await h.service.execute(staff, command('grant', { userId: 2, canApprove: true }))
  await assert.rejects(h.service.execute(staff, command('edit', { revisionId: first.revisionId, expectedReviewVersion: 1, metadata: { ...metadata, thumbnailId: 31 } })), { status: 409 })
  await assert.rejects(h.service.execute(staff, command('edit', { revisionId: first.revisionId, expectedReviewVersion: 1, metadata })), { status: 409 })
  await h.service.execute(staff, command('edit', { revisionId: first.revisionId, expectedReviewVersion: 1, metadata: { ...metadata, title: 'Edited title', thumbnailId: 30 } }))
  const second = await h.service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 22, metadata: { ...metadata, thumbnailId: 31 } }))
  const result = await h.service.read(10, client)
  assert.deepEqual(result.revisions.map(item => item.metadata.thumbnailId), [30, 31])
  assert.deepEqual(result.revisions.map(item => item.thumbnailUrl), [first, second].map(item => `/api/review/thumbnail?videoId=10&revisionId=${item.revisionId}`))
  await assert.rejects(h.service.read(10, stranger), { status: 404 })
  await h.service.execute(staff, command('revoke', { userId: 2 }))
  await assert.rejects(h.service.revision(10, String(first.revisionId), client), { status: 404 })
})

test('published media URL is canonical whichever host runs publish', async t => {
  const auth = authConfig({ OIDC_DIRECT_ORIGINS: '["https://admin.rawkode.academy"]', OIDC_BRIDGE_ORIGINS: '["https://preview.rawkode.academy"]', REVIEW_PUBLIC_MEDIA_ORIGIN: 'https://admin.rawkode.academy' })
  for (const origin of auth.origins) {
    const h = await harness(t, publishedMediaUrl(auth)), revision = await h.prepare()
    const decision = await h.approve(revision)
    const handlers = createReviewHandlers(async () => ({ service: h.service, actor: staff, origin }))
    const response = await handlers.POST(new Request(`${origin}/api/review`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(command('publish', { revisionId: revision.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId })) }))
    assert.equal(response.status, 200, await response.clone().text())
    const projection = JSON.parse(String(h.sqlite.prepare('SELECT document FROM video_publications').get()?.document))
    assert.match(projection.streamUrl, /^https:\/\/admin\.rawkode\.academy\/api\/review\/published-media\?videoId=10&publicationId=/, origin)
  }
})
