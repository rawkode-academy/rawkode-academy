import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { type TestContext } from 'node:test'
import { migrations } from '../src/migrations-cuid2'
import { ReviewService } from '../src/review/service'
import { actorFromUser } from '../src/review/contracts'
import { reviewCollections } from '../src/review/collections'
import { noDevelopers } from '../src/admin/access'
import { createReviewHandlers } from '../src/review/http'
import { byteRange, mediaResponse, publishedMediaResponse } from '../src/review/media'
import { digestBytes, fixtureChecksum, verifiedDeliverable, stageReleaseObject } from '../src/review/artifacts'
import { authConfig } from '../src/auth/config'
import { publishedMediaUrl } from '../src/review/host'

import { client, command, harness as reviewHarness, metadata, staff, stranger, CLIENT_ID, DELIVERABLE_MEDIA_ID, OTHER_VIDEO_ID, SECOND_DELIVERABLE_MEDIA_ID, SOURCE_MEDIA_ID, STRANGER_ID, THUMBNAIL_ID, OTHER_THUMBNAIL_ID, VIDEO_ID } from './helpers/review-harness'
import { createCuid2, isCuid2 } from '../src/cuid2'

const harness = (t: TestContext, publicMediaUrl?: (videoId: string, publicationId: string) => string) => reviewHarness(t, { publicMediaUrl })

test('client review, immutable cuts, explicit approval and separate atomic staff publication', async t => {
  const h = await harness(t), revision = await h.prepare()
  const grantId = String(h.sqlite.prepare('SELECT id FROM review_revision_grants WHERE revision_id=? AND user_id=?').get(revision.revisionId, CLIENT_ID)?.id)
  assert.ok(isCuid2(grantId), 'the server allocates a canonical CUID2 for each new revision grant')
  await assert.rejects(h.service.read(VIDEO_ID, stranger), { status: 404 })
  await assert.rejects(h.service.execute(client, command('publish', { revisionId: revision.revisionId, expectedReviewVersion: 1, decisionId: createCuid2() })), { status: 403 })
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
  assert.equal(projection.id, VIDEO_ID); assert.equal(projection.legacyId, undefined)
  assert.equal(projection.title, metadata.title); assert.ok(projection.publishedAt)
  assert.equal(projection.duration, 60)
  assert.deepEqual(projection.reviewChapters, metadata.chapters.map((chapter, index) => ({ ...chapter, legacyId: `${VIDEO_ID}-${revision.revisionId}-${index}` })))
  assert.match(projection.streamUrl, /published-media/)
  const read = await h.service.read(VIDEO_ID, client)
  assert.equal(read.resolutions.length, 3)
  assert.deepEqual(read.resolutions.map((event: any) => event.actorId).sort(), [staff.id, client.id, client.id].sort())
  assert.ok(read.resolutions.every((event: any) => event.createdAt))
  assert.equal(read.comments.length, 1); assert.equal(read.revisions[0].metadata.title, metadata.title)
  assert.equal(JSON.stringify(read).includes('checksum'), false)
  assert.equal(JSON.stringify(read).includes('original.mp4'), false)
  const next = await h.service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: SECOND_DELIVERABLE_MEDIA_ID, durationMs: 60000, metadata: { ...metadata, title: 'Next cut' } }))
  assert.notEqual(next.revisionId, revision.revisionId)
  const afterNext = await h.service.read(VIDEO_ID, client)
  assert.equal(afterNext.comments.length, 1)
  assert.deepEqual(afterNext.revisions.map(item => item.id), [revision.revisionId], 'a new cut stays hidden until staff share it')
  assert.equal(afterNext.currentRevisionId, revision.revisionId, 'the client still sees their newest shared cut as current')
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
  await h.service.execute(staff, command('revoke', { userId: CLIENT_ID }))
  await assert.rejects(h.service.read(VIDEO_ID, client), { status: 404 })
  await h.share(revision.revisionId)
  await assert.rejects(h.service.execute(staff, command('publish', { revisionId: revision.revisionId, expectedReviewVersion: 2, decisionId: approved.decisionId })), { status: 409 })
  assert.equal((await h.service.read(VIDEO_ID, client)).revisions[0].state, 'approved')
  const next = await h.service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: SECOND_DELIVERABLE_MEDIA_ID, durationMs: 60000, metadata }))
  await assert.rejects(h.service.execute(client, command('decide', { revisionId: next.revisionId, expectedReviewVersion: 1, decision: 'changes-requested' })), { status: 404 })
  await h.share(next.revisionId)
  await h.service.execute(client, command('decide', { revisionId: next.revisionId, expectedReviewVersion: 1, decision: 'changes-requested', note: 'Fix the example' }))
  assert.equal((await h.service.revision(VIDEO_ID, next.revisionId, client)).state, 'changes-requested')
})

test('timestamp, chapter, identity, command ownership and cross-video validation fail closed', async t => {
  const h = await harness(t), revision = await h.prepare()
  for (const user of [null, { ...client, collection: 'other' }, { ...client, id: 'invalid' }]) assert.throws(() => actorFromUser(user), { status: 401 })
  for (const times of [{ startMs: -1 }, { startMs: 60000 }, { startMs: 10, endMs: 9 }, { startMs: 10, endMs: 60001 }, { startMs: 1.2 }]) await assert.rejects(h.service.execute(client, command('comment', { revisionId: revision.revisionId, body: 'x', ...times })), { status: 400 })
  await assert.rejects(h.service.execute(staff, command('edit', { revisionId: revision.revisionId, expectedReviewVersion: 1, metadata: { ...metadata, chapters: [{ title: 'Bad', startTime: 60 }] } })), { status: 400 })
  await assert.rejects(h.service.execute(client, command('comment', { videoId: OTHER_VIDEO_ID, revisionId: revision.revisionId, startMs: 0, body: 'x' })), { status: 404 })
  const request = command('comment', { revisionId: revision.revisionId, startMs: 0, body: 'x' })
  await h.service.execute(client, request)
  await assert.rejects(h.service.execute(staff, request), { status: 409 })
  await assert.rejects(h.service.execute(client, { ...request, body: 'different' }), { status: 409 })
  await assert.rejects(h.service.execute(client, { ...request, authorId: 1 }), { status: 400 })
  await assert.rejects(h.service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: DELIVERABLE_MEDIA_ID, durationMs: 123, metadata })), { status: 400 })
  await assert.rejects(h.service.execute(staff, command('edit', { revisionId: revision.revisionId, expectedReviewVersion: 1, metadata: { ...metadata, chapters: [{ title: 'Fractional', startTime: 0.5 }] } })), { status: 400 })
  await h.service.execute(staff, command('revoke', { userId: CLIENT_ID }))
  await assert.rejects(h.service.execute(client, request), { status: 404 }, 'revoked users cannot replay saved results')
})

test('publish loses concurrent edit or revocation, and two edits cannot both use one review version', async t => {
  const h = await harness(t), revision = await h.prepare(), decision = await h.approve(revision)
  let release!: () => void, entered!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { entered = resolve })
  h.pauseSource(async () => { entered(); await waiting })
  const publishing = h.service.execute(staff, command('publish', { revisionId: revision.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId }))
  await started
  await h.service.execute(staff, command('revoke', { userId: CLIENT_ID }))
  release()
  await assert.rejects(publishing, { status: 409 })
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM video_publications').get()?.n, 0)
  h.pauseSource()
  const fresh = await h.service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: SECOND_DELIVERABLE_MEDIA_ID, durationMs: 60000, metadata }))
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
  for (const mediaId of [SOURCE_MEDIA_ID, DELIVERABLE_MEDIA_ID]) {
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
  assert.throws(() => h.sqlite.exec(`INSERT INTO pipeline_runs(id,key,video_id,media_id,state) VALUES('${createCuid2()}','bypass','${VIDEO_ID}','${SOURCE_MEDIA_ID}','registered')`), /Managed video/)
  assert.deepEqual(tables.map(table => h.sqlite.prepare(`SELECT * FROM ${table}`).all()), before)
  await assert.rejects(migrations.find(m => m.name === 'cuid2_20261005_120000_video_review')!.down(h.migrationArgs), /CHECK constraint/)
  assert.equal((await h.service.read(VIDEO_ID, client)).revisions.length, 1)
})

test('migration matches snapshot indexes, empty downgrade works, and legacy pipeline cannot enroll', async t => {
  const h = await harness(t)
  const snapshot = JSON.parse(await readFile(new URL('../src/migrations-cuid2/cuid2_20261009_130000_review_revision_grants.json', import.meta.url), 'utf8')) as {
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
  h.sqlite.exec(`INSERT INTO pipeline_runs(id,key,video_id,media_id,state) VALUES('${createCuid2()}','legacy','${VIDEO_ID}','${SOURCE_MEDIA_ID}','registered')`)
  await assert.rejects(h.prepare(), { status: 409 })
  // Roll back in reverse order: the revision grant expand first.
  await migrations.find(m => m.name === 'cuid2_20261009_130000_review_revision_grants')!.down(h.migrationArgs)
  await migrations.find(m => m.name === 'cuid2_20261005_120000_video_review')!.down(h.migrationArgs)
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
    assert.equal((await h.service.revision(VIDEO_ID, revision.revisionId, client)).state, 'approved')
  }
  h.fail(-1)
  await h.service.execute(staff, publish)
  const release = h.sqlite.prepare('SELECT * FROM review_publication_events').get()!
  assert.match(String(release.object_key), /^review-releases\//)
  assert.equal(release.checksum, 'b'.repeat(64))
  assert.equal(release.object_etag, 'release-etag')
  assert.throws(() => h.sqlite.exec("UPDATE review_comment_resolutions SET actor_id=3"), /immutable/)
})

test('review collection REST reads and generic mutations stay staff-only', async () => {
  for (const collection of reviewCollections(noDevelopers)) {
    for (const action of ['create','update','delete'] as const) assert.equal(await collection.access![action]!({ req: { user: staff } } as never), false)
    assert.equal(await collection.access!.read!({ req: { user: client } } as never), false, `${collection.slug} is only read internally by the bridge`)
  }
})

test('assigned clients resolve only their own comments, staff resolve any, revoked clients resolve none', async t => {
  const h = await harness(t), revision = await h.prepare()
  await h.share(revision.revisionId, STRANGER_ID, false)
  const own = await h.service.execute(client, command('comment', { revisionId: revision.revisionId, startMs: 0, body: 'Client comment' }))
  const other = await h.service.execute(stranger, command('comment', { revisionId: revision.revisionId, startMs: 0, body: 'Other client comment' }))
  await h.service.execute(client, command('resolve-comment', { commentId: own.commentId, resolved: true }))
  // Another customer's comment is invisible, so it is reported exactly like a missing one.
  await assert.rejects(h.service.execute(client, command('resolve-comment', { commentId: other.commentId, resolved: true })), { status: 404, message: 'Comment not found' })
  await h.service.execute(staff, command('resolve-comment', { commentId: other.commentId, resolved: true }))
  await h.service.execute(staff, command('revoke', { userId: CLIENT_ID }))
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
  const response = await handlers.GET(new Request(`https://preview.example/api/review?videoId=${VIDEO_ID}`))
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

test('published release media follows current visibility and is never cached across unpublish', async () => {
  const publicationId = createCuid2()
  let video: Record<string, unknown> = { id: VIDEO_ID, _status: 'published', tombstone: false, type: 'recorded', publishedAt: '2026-10-09T00:00:00.000Z' }
  const projection = { id: VIDEO_ID, _status: 'published', tombstone: false, type: 'recorded', publishedAt: '2026-10-10T11:00:00.000Z', streamUrl: `https://admin.example/api/review/published-media?videoId=${VIDEO_ID}&publicationId=${publicationId}` }
  const event = { object_key: 'review-releases/current.mp4', object_etag: 'opaque-etag', bytes: 4, content_type: 'video/mp4', published_at: projection.publishedAt }
  const payload = { async findByID() { return video } }
  const store = { async one(query: string) { return query.includes('FROM video_publications') ? { document: JSON.stringify(projection) } : event } }
  const bucket = {
    async head() { return { size: 4, etag: 'opaque-etag', httpEtag: '"opaque-etag"', httpMetadata: { contentType: 'video/mp4' } } },
    async get() { return { body: new Blob(['data']).stream() } },
  }
  const request = new Request(`https://admin.example/api/review/published-media?videoId=${VIDEO_ID}&publicationId=${publicationId}`)
  const response = await publishedMediaResponse(request, payload as never, store as never, bucket as never, VIDEO_ID, publicationId, Date.parse('2026-10-10T12:00:00.000Z'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(await response.text(), 'data')

  for (const hidden of [
    { ...video, _status: 'draft' },
    { ...video, tombstone: true },
    { ...video, publishedAt: '2026-10-11T00:00:00.000Z' },
    { ...video, type: 'live', publishedAt: '2026-10-11T00:00:00.000Z' },
  ]) {
    video = hidden
    await assert.rejects(publishedMediaResponse(request, payload as never, store as never, bucket as never, VIDEO_ID, publicationId, Date.parse('2026-10-10T12:00:00.000Z')), { status: 404 })
  }
  video = { id: VIDEO_ID, _status: 'published', tombstone: false, type: 'recorded', publishedAt: '2026-10-09T00:00:00.000Z' }
  await assert.rejects(publishedMediaResponse(request, payload as never, store as never, bucket as never, VIDEO_ID, createCuid2(), Date.parse('2026-10-10T12:00:00.000Z')), { status: 404 })
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
  const h = await harness(t); const first = await h.prepare()
  const other = await h.service.execute(staff, command('create-revision', { videoId: OTHER_VIDEO_ID, mediaId: SOURCE_MEDIA_ID, deliverableMediaId: DELIVERABLE_MEDIA_ID, metadata: { ...metadata, title: 'Other customer secret' } }))
  await h.share(other.revisionId, STRANGER_ID, true, 1, OTHER_VIDEO_ID)
  assert.deepEqual((await h.service.list(client)).items.map(item => item.videoId), [VIDEO_ID])
  assert.deepEqual((await h.service.list(stranger)).items.map(item => item.videoId), [OTHER_VIDEO_ID])
  assert.deepEqual((await h.service.list(staff)).items.map(item => item.videoId), [VIDEO_ID, OTHER_VIDEO_ID])
  const handlers = createReviewHandlers(async () => ({ service: h.service, actor: client, origin: 'https://preview.rawkode.academy' }))
  const response = await handlers.GET(new Request('https://preview.rawkode.academy/api/review'))
  const listing = await response.json() as Awaited<ReturnType<ReviewService['list']>>
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(Object.keys(listing.items[0]).sort(), ['reviewVersion', 'revisionId', 'state', 'title', 'videoId'])
  assert.equal(JSON.stringify(listing).includes('Other customer secret'), false)
  assert.equal((await h.service.read(VIDEO_ID, client)).canApprove, true)
  const version = () => h.sqlite.prepare(`SELECT version FROM review_revision_grants WHERE revision_id=? AND user_id='${CLIENT_ID}'`).get(first.revisionId)?.version
  assert.equal(version(), 1)
  await h.share(first.revisionId, CLIENT_ID, false)
  assert.equal(version(), 2, 'changing approval rights bumps the grant version')
  const read = await h.service.read(VIDEO_ID, client)
  assert.equal(read.canApprove, false); assert.equal(read.revisions[0].canApprove, false)
  await h.service.execute(staff, command('revoke', { userId: CLIENT_ID }))
  assert.deepEqual((await h.service.list(client)).items, [])
  assert.equal((await handlers.GET(new Request(`https://preview.rawkode.academy/api/review?videoId=${VIDEO_ID}`))).status, 404)
  for (const cursor of ['-1', '1.2', 'x', '9007199254740992']) assert.equal((await handlers.GET(new Request(`https://preview.rawkode.academy/api/review?after=${cursor}`))).status, 400)
  await assert.rejects(h.service.execute(staff, command('grant', { userId: CLIENT_ID, canApprove: true })), { status: 400 }, 'the video-wide grant command is gone')
})

test('review list paginates by stable video ID without skipping customer grants', async t => {
  const h = await harness(t)
  const ids = Array.from({ length: 51 }, () => createCuid2())
  for (const [index, id] of ids.entries()) {
    h.sqlite.prepare('INSERT INTO videos(id,slug,title,_status) VALUES(?,?,?,?)').run(id, `video-${index}`, 'Review', 'draft')
    const revision = await h.service.execute(staff, command('create-revision', { videoId: id, mediaId: SOURCE_MEDIA_ID, deliverableMediaId: DELIVERABLE_MEDIA_ID, metadata }))
    await h.share(revision.revisionId, CLIENT_ID, false, 1, id)
  }
  const first = await h.service.list(client)
  assert.equal(first.items.length, 50); assert.equal(first.nextCursor, ids[49])
  const next = await h.service.list(client, first.nextCursor!)
  assert.deepEqual(next.items.map(item => item.videoId), [ids[50]]); assert.equal(next.nextCursor, null)
})


test('thumbnail snapshots remain video-owned, private and unchanged on older revisions', async t => {
  const h = await harness(t)
  h.service.dependencies.thumbnail = async (videoId, thumbnailId) => {
    if (videoId !== VIDEO_ID || ![THUMBNAIL_ID, OTHER_THUMBNAIL_ID].includes(thumbnailId)) throw new Error('Thumbnail belongs to another video')
  }
  await assert.rejects(h.service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: DELIVERABLE_MEDIA_ID, metadata: { ...metadata, thumbnailId: 'z00000000000000000000000' } })), /another video/)
  const first = await h.service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: DELIVERABLE_MEDIA_ID, metadata: { ...metadata, thumbnailId: THUMBNAIL_ID } }))
  await h.share(first.revisionId)
  await assert.rejects(h.service.execute(staff, command('edit', { revisionId: first.revisionId, expectedReviewVersion: 1, metadata: { ...metadata, thumbnailId: OTHER_THUMBNAIL_ID } })), { status: 409 })
  await assert.rejects(h.service.execute(staff, command('edit', { revisionId: first.revisionId, expectedReviewVersion: 1, metadata })), { status: 409 })
  await h.service.execute(staff, command('edit', { revisionId: first.revisionId, expectedReviewVersion: 1, metadata: { ...metadata, title: 'Edited title', thumbnailId: THUMBNAIL_ID } }))
  const second = await h.service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: SECOND_DELIVERABLE_MEDIA_ID, metadata: { ...metadata, thumbnailId: OTHER_THUMBNAIL_ID } }))
  await h.share(second.revisionId)
  const result = await h.service.read(VIDEO_ID, client)
  assert.deepEqual(result.revisions.map(item => item.metadata.thumbnailId), [THUMBNAIL_ID, OTHER_THUMBNAIL_ID])
  assert.deepEqual(result.revisions.map(item => item.thumbnailUrl), [first, second].map(item => `/api/review/thumbnail?videoId=${VIDEO_ID}&revisionId=${item.revisionId}`))
  await assert.rejects(h.service.read(VIDEO_ID, stranger), { status: 404 })
  await h.service.execute(staff, command('revoke', { userId: CLIENT_ID }))
  await assert.rejects(h.service.revision(VIDEO_ID, String(first.revisionId), client), { status: 404 })
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
    assert.ok(projection.streamUrl.startsWith(`https://admin.rawkode.academy/api/review/published-media?videoId=${VIDEO_ID}&publicationId=`), origin)
  }
})
