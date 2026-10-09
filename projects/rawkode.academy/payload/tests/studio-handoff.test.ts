import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { harness, staff, client, metadata as reviewMetadata, command } from './helpers/review-harness'
import { ReviewService } from '../src/review/service'
import { ReviewError, type ReviewActor } from '../src/review/contracts'
import { mediaResponse } from '../src/review/media'
import { readOnlyStudioContent } from '../src/review/studio-content'
import { StudioAssets, StudioHandoff, isStudioPublication, listPendingStudioAdoptions, studioStageRelease, studioTranscodeStallMs } from '../src/review/studio-handoff'
import { STUDIO_REVIEW_STATUS_FIXTURE, clampMetadata, parseTranscodeStatus, studioIdempotencyKey } from '../src/review/studio-contracts'
import { createStudioAdoptionListHandlers, createStudioHandoffHandlers } from '../src/review/studio-http'
import { MACHINE_AUTH_TEST_VECTOR, MachineAuthError, canonicalQuery, canonicalRequest, ensureMachineActor, isSystemIdentity, sha256Hex, signMachineRequest, verifyMachineRequest } from '../src/machine-auth'
import { usersCollection } from '../src/auth/payload'
import { authConfig } from '../src/auth/config'

const system: ReviewActor = { id: 5, collection: 'users', role: 'staff' }
const bucketName = 'rawkode-academy-content'
const secret = 'studio-machine-secret-for-tests-0123456789'
const session = 'session-1', recording = 'recording-1', prefix = `studio/recordings/${session}/${recording}/`
const sourceKey = `${prefix}source.webm`, reviewPrefix = `${prefix}review/`
const reviewKey = `${reviewPrefix}transcoding-job-x7k2p-a0/review.mp4`
const deliverableSha = 'd'.repeat(64)

type StoredObject = { bytes: Uint8Array; etag: string; contentType: string }
function contentBucket() {
  const objects = new Map<string, StoredObject>()
  const calls = { head: 0, get: 0, put: 0, delete: 0 }
  const object = (key: string, entry: StoredObject) => ({ key, etag: entry.etag, httpEtag: `"${entry.etag}"`, size: entry.bytes.length, httpMetadata: { contentType: entry.contentType }, checksums: {} })
  const bucket = {
    async head(key: string) { calls.head++; const entry = objects.get(key); return entry ? object(key, entry) : null },
    async get(key: string, options?: R2GetOptions) {
      calls.get++
      const entry = objects.get(key)
      if (!entry) return null
      if (options?.onlyIf && 'etagMatches' in options.onlyIf && options.onlyIf.etagMatches !== entry.etag) return object(key, entry)
      const range = options?.range as { offset: number; length: number } | undefined
      const bytes = range ? entry.bytes.slice(range.offset, range.offset + range.length) : entry.bytes
      return { ...object(key, entry), body: new Blob([bytes as BlobPart]).stream(), json: async () => JSON.parse(new TextDecoder().decode(entry.bytes)) }
    },
    async put() { calls.put++; throw new Error('put must never be called on Studio content') },
    async delete() { calls.delete++; throw new Error('delete must never be called on Studio content') },
    async createMultipartUpload() { throw new Error('uploads must never start on Studio content') },
  } as unknown as R2Bucket
  return {
    bucket, calls, objects,
    set(key: string, value: string | Uint8Array, etag: string, contentType = 'application/octet-stream') { objects.set(key, { bytes: typeof value === 'string' ? new TextEncoder().encode(value) : value, etag, contentType }) },
    status(document: Record<string, unknown>, etag = crypto.randomUUID()) { this.set(`${reviewPrefix}transcode-status.json`, JSON.stringify(document), etag, 'application/json') },
  }
}
const sourceBytes = new Uint8Array(4096).fill(7)
const deliverableBytes = new Uint8Array(1000).map((_, index) => index % 251)
const reviewBlock = (overrides: Record<string, unknown> = {}) => ({ key: reviewKey, etag: 'review-etag-1', bytes: deliverableBytes.length, sha256: deliverableSha, durationMs: 61000, contentType: 'video/mp4', ...overrides })
const baseStatus = { videoId: 'stable-video', studioSessionId: session, recordingId: recording, sourceBucket: bucketName, sourceKey, sourceEtag: 'source-etag-1', sourceFormat: 'webm', outputPrefix: reviewPrefix }
function adoptBody(overrides: Record<string, unknown> = {}) {
  return { idempotencyKey: studioIdempotencyKey(session, recording, 'source-etag-1'), legacyVideoId: 'stable-video', studioSessionId: session, recordingId: recording, source: { bucket: bucketName, key: sourceKey, etag: 'source-etag-1', bytes: sourceBytes.length, format: 'webm' }, reviewPrefix, requestedBy: { githubHandle: 'rawkode', issuer: 'https://id.rawkode.academy', subject: 'subject-1' }, title: 'Studio take', ...overrides }
}

async function studioHarness(t: TestContext) {
  const h = await harness(t)
  h.sqlite.exec("INSERT INTO users(id,email,role,name,identity_key) VALUES(5,'rawkode-studio@system.invalid','staff','Rawkode Studio','system:rawkode-studio')")
  const content = contentBucket()
  content.set(sourceKey, sourceBytes, 'source-etag-1', 'video/webm')
  const facade = readOnlyStudioContent(content.bucket)
  const assets = new StudioAssets(h.store, facade)
  let clock = 1_000_000
  const service = new ReviewService(h.store, {
    async video(id) {
      const row = h.sqlite.prepare('SELECT * FROM videos WHERE id=?').get(id)
      if (!row) throw new ReviewError(404, 'missing video')
      return { id, legacyId: String(row.legacy_id), slug: String(row.slug), title: String(row.title) }
    },
    async assertPair(videoId, sourceId, deliverableId) { if (!await assets.pair(videoId, sourceId, deliverableId)) throw new ReviewError(409, 'not a Studio pair') },
    async source(mediaId, _actor, videoId) {
      const studio = await assets.resolve(mediaId, videoId, 'source')
      return { checksum: studio?.checksum ?? h.sources.get(mediaId)! }
    },
    async deliverable(mediaId, _actor, videoId) {
      const studio = await assets.resolve(mediaId, videoId, 'deliverable')
      return studio ? { checksum: studio.checksum, durationMs: studio.duration_ms!, contentType: studio.content_type } : { checksum: h.sources.get(mediaId)!, durationMs: 60000, contentType: 'video/mp4' }
    },
    async stageRelease(videoId, publicationId, mediaId, checksum) {
      return (await studioStageRelease(assets, videoId, mediaId, checksum)) ?? { key: `review-releases/${videoId}/${publicationId}.mp4`, etag: 'release', checksum, bytes: 1, contentType: 'video/mp4' }
    },
    publicMediaUrl: (videoId, publicationId) => `https://admin.example/api/review/published-media?videoId=${videoId}&publicationId=${publicationId}`,
    now: () => h.now(),
  })
  let videoLookups = 0
  const resolveVideo = async (legacyId: string) => {
    videoLookups++
    const row = h.sqlite.prepare('SELECT * FROM videos WHERE legacy_id=?').get(legacyId)
    if (!row) throw new ReviewError(404, 'No Payload video has this legacy ID')
    return { id: Number(row.id), legacyId, title: row.title, description: row.description }
  }
  const handoff = new StudioHandoff(h.store, facade, service, resolveVideo, system, bucketName, () => ++clock)
  const complete = (overrides: Record<string, unknown> = {}) => {
    content.set(reviewKey, deliverableBytes, 'review-etag-1', 'video/mp4')
    content.status({ ...baseStatus, status: 'complete', completedAt: '2026-10-09T12:00:00.000Z', outputMode: 'review-proxy', review: reviewBlock(overrides) })
  }
  const adoption = (id: string) => h.sqlite.prepare('SELECT * FROM review_studio_adoptions WHERE id=?').get(id) as Record<string, unknown>
  return { ...h, content, facade, assets, service, handoff, complete, adoption, videoLookups: () => videoLookups }
}

test('machine auth signs the shared test vector exactly', async () => {
  const v = MACHINE_AUTH_TEST_VECTOR
  assert.equal(canonicalRequest({ method: v.method, path: v.path, query: canonicalQuery(v.query), principal: v.principal, timestamp: v.timestamp, idempotencyKey: v.idempotencyKey, bodySha256: await sha256Hex(v.body) }), v.canonical)
  const headers = await signMachineRequest(v.secret, { method: v.method, path: v.path, query: v.query, principal: 'rawkode-studio', timestamp: v.timestamp, idempotencyKey: v.idempotencyKey, body: v.body })
  assert.equal(headers['x-rawkode-signature'], v.signature)
})

async function signed(body: string, options: { method?: string; query?: string; timestamp?: number; key?: string | null; tamper?: (headers: Headers) => void; url?: string } = {}) {
  const method = options.method ?? 'POST', timestamp = options.timestamp ?? Math.floor(Date.now() / 1000)
  const key = options.key === undefined ? studioIdempotencyKey(session, recording, 'source-etag-1') : options.key
  const headers = new Headers(await signMachineRequest(secret, { method, path: '/api/studio-handoff/adoptions', query: options.query ?? '', principal: 'rawkode-studio', timestamp, idempotencyKey: key, body: method === 'GET' ? '' : body }))
  headers.set('content-type', 'application/json')
  options.tamper?.(headers)
  // OpenNext may rewrite the pathname; the signature binds the route constant instead.
  return new Request(`${options.url ?? 'https://admin.rawkode.academy/internal/rewritten'}${options.query ? `?${options.query}` : ''}`, { method, headers, ...(method === 'GET' ? {} : { body }) })
}

test('machine auth rejects tampering, skew, missing secrets, cookies, oversized bodies and unkeyed mutations', async () => {
  const body = JSON.stringify({ hello: 'world' })
  const verify = (request: Request, extra: Partial<Parameters<typeof verifyMachineRequest>[1]> = {}) => verifyMachineRequest(request, { path: '/api/studio-handoff/adoptions', principal: 'rawkode-studio', secret, ...extra })
  const ok = await verify(await signed(body))
  assert.deepEqual(ok.json(), { hello: 'world' })
  const status = async (promise: Promise<unknown>) => { try { await promise; return 200 } catch (error) { assert.ok(error instanceof MachineAuthError); return error.status } }
  // Tampered body: same headers, different bytes.
  const original = await signed(body)
  assert.equal(await status(verify(new Request(original.url, { method: 'POST', headers: original.headers, body: JSON.stringify({ hello: 'mars' }) }))), 401)
  // A different query than the one signed.
  const query = await signed('', { method: 'GET', key: null, query: 'adoptionId=a' })
  assert.equal(await status(verify(new Request(query.url.replace('adoptionId=a', 'adoptionId=b'), { headers: query.headers }))), 401)
  // A signature for one route never verifies on another.
  assert.equal(await status(verify(await signed(body), { path: '/api/editorial/broadcast' })), 401)
  assert.equal(await status(verify(await signed(body, { timestamp: Math.floor(Date.now() / 1000) - 301 }))), 401)
  assert.equal(await status(verify(await signed(body, { timestamp: Math.floor(Date.now() / 1000) + 290 }))), 200)
  assert.equal(await status(verify(await signed(body), { secret: undefined })), 503)
  assert.equal(await status(verify(await signed(body), { secret: { get: async () => { throw new Error('unset') } } })), 503)
  assert.equal(await status(verify(await signed(body), { secret: { get: async () => secret } })), 200)
  assert.equal(await status(verify(await signed(body, { tamper: headers => headers.set('cookie', 'poc-oidc-session=x') }))), 401)
  assert.equal(await status(verify(await signed(body, { tamper: headers => headers.set('x-rawkode-principal', 'someone-else') }))), 401)
  assert.equal(await status(verify(await signed(body, { key: null }))), 400)
  assert.equal(await status(verify(await signed('x'.repeat(16385)))), 413)
})

test('the handoff endpoint answers 503 without bindings and binds the Idempotency-Key to the adoption', async t => {
  const h = await studioHarness(t)
  const body = JSON.stringify(adoptBody())
  const unconfigured = createStudioHandoffHandlers({ bindings: () => ({ STUDIO_CONTENT_BUCKET_NAME: bucketName }), runtime: async () => ({ handoff: h.handoff }) })
  assert.equal((await unconfigured.POST(await signed(body))).status, 503)
  const handlers = createStudioHandoffHandlers({ bindings: () => ({ STUDIO_CONTENT: h.content.bucket, STUDIO_CONTENT_BUCKET_NAME: bucketName, STUDIO_MACHINE_SECRET: secret }), runtime: async () => ({ handoff: h.handoff }) })
  assert.equal((await handlers.POST(await signed(body, { key: 'studio:other:recording:etag' }))).status, 400)
  const response = await handlers.POST(await signed(body))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const summary = await response.json() as { adoptionId: string; state: string; videoId: number }
  assert.equal(summary.state, 'awaiting-transcode')
  assert.equal(summary.videoId, 10)
  const read = await handlers.GET(await signed('', { method: 'GET', key: null, query: `adoptionId=${summary.adoptionId}` }))
  assert.equal(((await read.json()) as { adoptionId: string }).adoptionId, summary.adoptionId)
  // The staff listing refuses customers.
  const list = createStudioAdoptionListHandlers(async () => ({ actor: client, handoff: { listPending: () => listPendingStudioAdoptions(h.store) } }))
  assert.equal((await list.GET(new Request('https://admin.rawkode.academy/api/review/studio-adoptions'))).status, 403)
  const staffList = createStudioAdoptionListHandlers(async () => ({ actor: staff, handoff: { listPending: () => listPendingStudioAdoptions(h.store) } }))
  assert.equal(((await (await staffList.GET(new Request('https://admin.rawkode.academy/api/review/studio-adoptions'))).json()) as { adoptions: unknown[] }).adoptions.length, 1)
})

test('path contracts, bucket, source pins and unknown videos are enforced before any row is written', async t => {
  const h = await studioHarness(t)
  const rejects = async (body: unknown, status: number) => { await assert.rejects(h.handoff.adopt(body), (error: unknown) => error instanceof ReviewError && error.status === status) }
  await rejects(adoptBody({ source: { ...adoptBody().source, key: `${prefix}other.webm` } }), 400)
  await rejects(adoptBody({ reviewPrefix: 'videos/stable-video/' }), 400)
  await rejects(adoptBody({ source: { ...adoptBody().source, bucket: 'rawkode-academy-payload' } }), 400)
  await rejects(adoptBody({ idempotencyKey: studioIdempotencyKey(session, recording, 'other-etag') }), 400)
  await rejects({ ...adoptBody(), extra: true }, 400)
  await rejects(adoptBody({ source: { ...adoptBody().source, etag: 'source-etag-2' }, idempotencyKey: studioIdempotencyKey(session, recording, 'source-etag-2') }), 409)
  await rejects(adoptBody({ source: { ...adoptBody().source, bytes: 1 } }), 409)
  await rejects(adoptBody({ legacyVideoId: 'missing-video' }), 404)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_studio_adoptions').get()!.n, 0)
})

test('replays skip HEAD and video resolution; a reused key with other input conflicts', async t => {
  const h = await studioHarness(t)
  const first = await h.handoff.adopt(adoptBody())
  const heads = h.content.calls.head, lookups = h.videoLookups()
  const replay = await h.handoff.adopt(adoptBody())
  assert.equal(replay.adoptionId, first.adoptionId)
  assert.equal(h.content.calls.head, heads)
  assert.equal(h.videoLookups(), lookups)
  await assert.rejects(h.handoff.adopt(adoptBody({ title: 'Another title' })), /Idempotency key reused/)
  const row = h.adoption(first.adoptionId)
  assert.equal(JSON.parse(String(row.requested_by)).subject, 'subject-1')
  assert.equal(row.actor_id, 5)
})

test('missing, queued and running statuses wait; failed recovers without latching', async t => {
  const h = await studioHarness(t)
  const first = await h.handoff.adopt(adoptBody())
  assert.equal(first.state, 'awaiting-transcode')
  h.content.status({ ...baseStatus, status: 'queued', queuedAt: '2026-10-09T11:00:00.000Z' })
  assert.equal((await h.handoff.status({ adoptionId: first.adoptionId })).state, 'awaiting-transcode')
  h.content.status({ ...baseStatus, status: 'running', startedAt: '2026-10-09T11:01:00.000Z' })
  assert.equal((await h.handoff.status({ adoptionId: first.adoptionId })).state, 'awaiting-transcode')
  h.content.status({ ...baseStatus, status: 'failed', failedAt: '2026-10-09T11:02:00.000Z', error: 'Cloud Run jobs.run failed' })
  const failed = await h.handoff.status({ adoptionId: first.adoptionId })
  assert.equal(failed.state, 'failed')
  assert.equal(failed.error, 'Cloud Run jobs.run failed')
  h.content.status({ ...baseStatus, status: 'queued', queuedAt: '2026-10-09T11:03:00.000Z' })
  assert.equal((await h.handoff.status({ idempotencyKey: adoptBody().idempotencyKey })).state, 'awaiting-transcode')
  h.content.status({ ...baseStatus, status: 'failed', error: 'transient' })
  assert.equal((await h.handoff.status({ adoptionId: first.adoptionId })).state, 'failed')
  h.complete()
  const attached = await h.handoff.status({ adoptionId: first.adoptionId })
  assert.equal(attached.state, 'attached')
  assert.ok(attached.revisionId)
  const revision = h.sqlite.prepare('SELECT * FROM video_revisions WHERE id=?').get(attached.revisionId!)!
  assert.equal(revision.created_by_id, 5)
  assert.equal(revision.deliverable_checksum, deliverableSha)
  assert.equal(revision.checksum, 'r2-etag:source-etag-1')
  assert.equal(revision.duration_ms, 61000)
  // Attached is terminal, and the shared transcoder fixture (with extra fields) parses as a completion.
  const fixture = parseTranscodeStatus(JSON.parse(STUDIO_REVIEW_STATUS_FIXTURE), { review_prefix: reviewPrefix, source_etag: '"source-etag-1"' })
  assert.equal(fixture.review?.key, reviewKey)
  assert.equal(fixture.completedAt, '2026-10-09T12:00:00.000Z')
  h.content.status({ ...baseStatus, status: 'failed', error: 'late failure' })
  assert.equal((await h.handoff.status({ adoptionId: first.adoptionId })).state, 'attached')
})

test('a queued or running status with no terminal update past the task timeout reads as failed', async t => {
  const h = await studioHarness(t)
  const first = await h.handoff.adopt(adoptBody())
  const startedAt = Date.parse('2026-10-09T11:00:00.000Z')
  let now = startedAt + studioTranscodeStallMs - 1000
  const late = new StudioHandoff(h.store, h.facade, h.service, async () => { throw new Error('not used') }, system, bucketName, () => now)
  h.content.status({ ...baseStatus, status: 'running', startedAt: '2026-10-09T11:00:00.000Z' })
  assert.equal((await late.status({ adoptionId: first.adoptionId })).state, 'awaiting-transcode')
  now = startedAt + studioTranscodeStallMs + 1000
  const stalled = await late.status({ adoptionId: first.adoptionId })
  assert.equal(stalled.state, 'failed')
  assert.match(stalled.error ?? '', /stalled: still running/)
  h.content.status({ ...baseStatus, status: 'queued', queuedAt: '2026-10-09T11:00:00.000Z' })
  assert.match((await late.status({ adoptionId: first.adoptionId })).error ?? '', /stalled: still queued/)
  // A retrigger writes a fresh queued status, which recovers the row.
  h.content.status({ ...baseStatus, status: 'queued', queuedAt: new Date(now - 1000).toISOString() })
  assert.equal((await late.status({ adoptionId: first.adoptionId })).state, 'awaiting-transcode')
  h.complete()
  assert.equal((await late.status({ adoptionId: first.adoptionId })).state, 'attached')
})

test('a changed review.mp4 is refused with no state change, and a foreign status is a visible failure', async t => {
  const h = await studioHarness(t)
  const first = await h.handoff.adopt(adoptBody())
  h.complete()
  h.content.set(reviewKey, deliverableBytes, 'review-etag-2', 'video/mp4')
  await assert.rejects(h.handoff.status({ adoptionId: first.adoptionId }), /Studio deliverable changed/)
  assert.equal(h.adoption(first.adoptionId).state, 'awaiting-transcode')
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_studio_assets').get()!.n, 0)
  h.content.status({ ...baseStatus, outputPrefix: 'videos/stable-video/', status: 'complete', review: reviewBlock() })
  const foreign = await h.handoff.status({ adoptionId: first.adoptionId })
  assert.equal(foreign.state, 'failed')
  h.content.status({ ...baseStatus, status: 'complete', review: reviewBlock({ key: 'videos/stable-video/review.mp4' }) })
  assert.equal((await h.handoff.status({ adoptionId: first.adoptionId })).state, 'failed')
})

test('concurrent adopts converge on exactly one revision', async t => {
  const h = await studioHarness(t)
  h.complete()
  const [a, b] = await Promise.all([h.handoff.adopt(adoptBody()), h.handoff.adopt(adoptBody())])
  assert.equal(a.state, 'attached')
  assert.equal(b.state, 'attached')
  assert.equal(a.revisionId, b.revisionId)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM video_revisions').get()!.n, 1)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_studio_assets').get()!.n, 2)
  assert.equal(h.content.calls.put + h.content.calls.delete, 0)
})

test('a second take attaches as the new current revision, and a raced staff cut defers to the next poll', async t => {
  const h = await studioHarness(t)
  h.complete()
  const first = await h.handoff.adopt(adoptBody())
  assert.equal(first.state, 'attached')
  // Second take: a fresh recording id, its own private prefix.
  const prefix2 = `studio/recordings/${session}/recording-2/`
  h.content.set(`${prefix2}source.webm`, sourceBytes, 'source-etag-9', 'video/webm')
  const second = adoptBody({ recordingId: 'recording-2', idempotencyKey: studioIdempotencyKey(session, 'recording-2', 'source-etag-9'), source: { ...adoptBody().source, key: `${prefix2}source.webm`, etag: 'source-etag-9' }, reviewPrefix: `${prefix2}review/` })
  const reviewKey2 = `${prefix2}review/transcoding-job-zz-a0/review.mp4`
  h.content.set(reviewKey2, deliverableBytes, 'review-etag-9', 'video/mp4')
  h.content.set(`${prefix2}review/transcode-status.json`, JSON.stringify({ ...baseStatus, recordingId: 'recording-2', sourceKey: `${prefix2}source.webm`, sourceEtag: 'source-etag-9', outputPrefix: `${prefix2}review/`, status: 'complete', review: reviewBlock({ key: reviewKey2, etag: 'review-etag-9' }) }), 'status-9', 'application/json')
  // A staff cut becomes current between the attach-time expectation and execute.
  const execute = h.service.execute.bind(h.service)
  let raced = false
  h.service.execute = async (actor, value, expected) => {
    if (!raced) {
      raced = true
      h.sqlite.prepare("INSERT INTO video_revisions(id,video_id,media_id,checksum,deliverable_media_id,deliverable_checksum,duration_ms,review_version,state,metadata,created_by_id,created_at) VALUES('staff-cut',10,20,'a',21,'b',60000,1,'ready',?,1,'2026-10-09T00:00:00.000Z')").run(JSON.stringify(reviewMetadata))
      h.sqlite.prepare("UPDATE video_review_state SET current_revision='staff-cut',generation=generation+1 WHERE video_id=10").run()
    }
    return execute(actor, value, expected)
  }
  const deferred = await h.handoff.adopt(second)
  assert.equal(deferred.state, 'awaiting-transcode')
  assert.match(deferred.error ?? '', /retrying/)
  const attached = await h.handoff.status({ adoptionId: deferred.adoptionId })
  assert.equal(attached.state, 'attached')
  assert.equal(h.sqlite.prepare('SELECT current_revision FROM video_review_state WHERE video_id=10').get()!.current_revision, attached.revisionId)
  assert.notEqual(attached.revisionId, first.revisionId)
  assert.equal(h.adoption(deferred.adoptionId).expected_current_revision, 'staff-cut')
})

test('over-long video text is clamped into a valid revision command', () => {
  const clamped = clampMetadata({ title: 'T'.repeat(500), description: 'D'.repeat(9000) }, { title: undefined }, recording)
  assert.equal(clamped.title.length, 300)
  assert.equal(clamped.description.length, 8000)
  assert.deepEqual(clampMetadata({ title: '  ', description: '' }, { title: undefined }, recording), { title: `Studio recording ${recording}`, description: `Recorded in Rawkode Studio (${recording})`, transcript: '', chapters: [] })
})

test('studio deliverables stream with ranges, publish to the content CDN, and are never served by published-media', async t => {
  const h = await studioHarness(t)
  h.complete()
  const attached = await h.handoff.adopt(adoptBody())
  const revision = h.sqlite.prepare('SELECT * FROM video_revisions WHERE id=?').get(attached.revisionId!)! as { deliverable_media_id: number }
  const asset = (await h.assets.resolve(revision.deliverable_media_id, 10, 'deliverable'))!
  const expected = { etag: asset.object_etag, bytes: asset.bytes, contentType: asset.content_type }
  const ranged = await mediaResponse(new Request('https://x/', { headers: { range: 'bytes=10-19' } }), h.facade, asset.object_key, false, expected)
  assert.equal(ranged.status, 206)
  assert.deepEqual(new Uint8Array(await ranged.arrayBuffer()), deliverableBytes.slice(10, 20))
  assert.equal(ranged.headers.get('cache-control'), 'private, no-store')
  assert.equal((await mediaResponse(new Request('https://x/', { headers: { range: 'bytes=5000-' } }), h.facade, asset.object_key, false, expected)).status, 416)
  // Staff share, the client approves, staff publish.
  await h.service.execute(staff, command('share', { revisionId: attached.revisionId, userId: 2, canApprove: true, expiresInDays: 7 }))
  const decision = await h.service.execute(client, command('decide', { revisionId: attached.revisionId, expectedReviewVersion: 1, decision: 'approved' })) as { decisionId: string }
  const published = await h.service.execute(staff, command('publish', { revisionId: attached.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId })) as { publicationId: string }
  const event = h.sqlite.prepare('SELECT * FROM review_publication_events WHERE id=?').get(published.publicationId)! as { object_key: string; object_etag: string; checksum: string }
  assert.equal(event.object_key, reviewKey)
  assert.equal(event.checksum, deliverableSha)
  assert.equal(await isStudioPublication(h.store, event.object_key, event.object_etag), true)
  const document = JSON.parse(String(h.sqlite.prepare('SELECT document FROM video_publications WHERE id=10').get()!.document))
  assert.equal(document.streamUrl, 'https://content.rawkode.academy/videos/stable-video/stream.m3u8')
  const status = await h.handoff.status({ adoptionId: attached.adoptionId })
  assert.equal(status.publication?.publicationId, published.publicationId)
  assert.deepEqual(await listPendingStudioAdoptions(h.store), [])
  assert.equal(h.content.calls.put + h.content.calls.delete, 0)
})

test('the read-only facade exposes only head and get', () => {
  const { bucket } = contentBucket()
  const facade = readOnlyStudioContent(bucket)
  assert.deepEqual(Object.keys(facade).sort(), ['get', 'head'])
  for (const method of ['put', 'delete', 'createMultipartUpload', 'resumeMultipartUpload', 'list']) assert.equal(method in facade, false)
  assert.ok(Object.isFrozen(facade))
})

test('system principals are provisioned once, cannot log in, and never count as staff comment authors', async t => {
  const users: Array<{ id: number; identityKey: string; role: string }> = []
  let creates = 0
  const payload = {
    async find({ where }: { where: { identityKey: { equals: string } } }) { return { docs: users.filter(user => user.identityKey === where.identityKey.equals) } },
    async create({ data, context }: { data: { identityKey: string; role: string }; context: { identityProvisioning: boolean } }) {
      creates++
      assert.equal(context.identityProvisioning, true)
      await new Promise(resolve => setTimeout(resolve, 1))
      if (users.some(user => user.identityKey === data.identityKey)) throw new Error('UNIQUE constraint failed: users.identity_key')
      const user = { id: 100 + users.length, identityKey: data.identityKey, role: data.role }
      users.push(user)
      return user
    },
  }
  const [a, b] = await Promise.all([ensureMachineActor(payload as never, 'rawkode-studio'), ensureMachineActor(payload as never, 'rawkode-studio')])
  assert.deepEqual(a, b)
  assert.deepEqual(a, { id: 100, collection: 'users', role: 'staff' })
  assert.equal(users.length, 1)
  assert.equal(creates, 2)
  assert.equal(isSystemIdentity('system:rawkode-studio'), true)
  assert.equal(isSystemIdentity('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'), false)
  const collection = usersCollection(authConfig({ POC_DEV_LOCAL_AUTH: 'true' }), {} as D1Database)
  const beforeLogin = collection.hooks!.beforeLogin![0] as (args: { user: Record<string, unknown> }) => void
  assert.throws(() => beforeLogin({ user: { identityKey: 'system:rawkode-studio', role: 'staff' } }), /disabled/)
  // A comment by the system principal stays hidden from customers; staff comments stay visible.
  const h = await studioHarness(t)
  h.complete()
  const attached = await h.handoff.adopt(adoptBody())
  await h.service.execute(staff, command('share', { revisionId: attached.revisionId, userId: 2, canApprove: true, expiresInDays: 7 }))
  for (const [id, author] of [['comment-staff', 1], ['comment-system', 5]] as const) h.sqlite.prepare("INSERT INTO review_comments(id,video_id,revision_id,author_id,start_ms,body,resolved,created_at) VALUES(?,10,?,?,0,'note',0,'2026-10-09T00:00:00.000Z')").run(id, attached.revisionId!, author)
  const read = await h.service.read(10, client) as { comments: Array<{ id: string }> }
  assert.deepEqual(read.comments.map(comment => comment.id), ['comment-staff'])
  assert.equal(await h.service.access.canSeeComment(client, { author_id: 5, revision_id: attached.revisionId! }), false)
})
