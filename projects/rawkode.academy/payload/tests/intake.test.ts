import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import test, { type TestContext } from 'node:test'
import { sql, type MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { migrations } from '../src/migrations'
import { ReviewStore } from '../src/review/store'
import { ReviewService } from '../src/review/service'
import { ReviewIntake } from '../src/review/intake'
import { createIntakeHandlers } from '../src/review/intake-http'
import { TrustedAssets, assetObject, uploadSource, verifyStored, hex, type LengthStream } from '../src/review/intake-storage'
import { configuredMediaAdapter, maximumIntakeBytes, type ContainerMediaAdapter, type ProbeResult } from '../src/review/intake-contracts'
import { mediaResponse } from '../src/review/media'
import type { ReviewActor } from '../src/review/contracts'

const staff: ReviewActor = { id: 1, collection: 'users', role: 'staff' }
const customer: ReviewActor = { id: 2, collection: 'users', role: 'customer' }
const otherStaff: ReviewActor = { id: 3, collection: 'users', role: 'staff' }
const origin = 'https://preview.rawkode.academy'
// Deliberately NOT real media. Only the injected adapter asserts playability.
const sourceBytes = new TextEncoder().encode('source fixture'), outputBytes = new TextEncoder().encode('encoded fixture')
const digest = async (bytes: Uint8Array) => hex(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
const lengthStream: LengthStream = bytes => {
  let seen = 0
  return new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) { seen += chunk.byteLength; if (seen > bytes) throw Error('long'); controller.enqueue(chunk) }, flush() { if (seen !== bytes) throw Error('short') } })
}
const stream = (bytes: Uint8Array = sourceBytes) => new Blob([bytes as BlobPart]).stream()
function fakeBucket() {
  const objects = new Map<string, { bytes: Uint8Array; head: R2Object }>()
  let puts = 0
  const bucket = {
    async head(key: string) { return objects.get(key)?.head ?? null },
    async put(key: string, body: ReadableStream, options: R2PutOptions) {
      puts++
      assert.ok(body instanceof ReadableStream, 'production code passes a stream')
      assert.deepEqual(options.onlyIf, { etagDoesNotMatch: '*' })
      if (objects.has(key)) return null
      const bytes = new Uint8Array(await new Response(body).arrayBuffer()), checksum = await digest(bytes)
      if (options.sha256 !== checksum) throw Error('checksum mismatch')
      const head = { key, etag: checksum.slice(0, 32), httpEtag: `"${checksum.slice(0, 32)}"`, size: bytes.length, checksums: { sha256: await crypto.subtle.digest('SHA-256', bytes) }, httpMetadata: options.httpMetadata } as R2Object
      objects.set(key, { bytes, head }); return head
    },
    async get(key: string, options?: R2GetOptions) {
      const entry = objects.get(key)
      if (!entry) return null
      if (options?.onlyIf && 'etagMatches' in options.onlyIf && options.onlyIf.etagMatches !== entry.head.etag) return entry.head
      const range = options?.range as { offset: number; length: number } | undefined
      return { ...entry.head, body: stream(range ? entry.bytes.slice(range.offset, range.offset + range.length) : entry.bytes) }
    },
  } as unknown as R2Bucket
  return { bucket, objects, puts: () => puts }
}
async function harness(t: TestContext, provider = true) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close()); sqlite.exec('PRAGMA foreign_keys=ON')
  const args = { db: { run(statement: ReturnType<typeof sql>) {
    const query = statement.toQuery({ casing: undefined as never, escapeName: v => `"${v}"`, escapeParam: () => '?', escapeString: v => `'${v.replaceAll("'", "''")}'` })
    assert.equal(query.params.length, 0); sqlite.exec(query.sql)
  } } } as unknown as MigrateUpArgs
  for (const migration of migrations) { sqlite.exec('BEGIN; PRAGMA defer_foreign_keys=ON'); await migration.up(args); sqlite.exec('COMMIT') }
  sqlite.exec("INSERT INTO users(id,email,role) VALUES(1,'staff@example.invalid','staff'),(2,'customer@example.invalid','customer'),(3,'staff2@example.invalid','staff'); INSERT INTO videos(id,legacy_id,legacy_type,slug,title) VALUES(10,'one','Video','one','One'),(11,'two','Video','two','Two')")
  let failSQL: RegExp | undefined, clock = 1000
  class Prepared {
    values: (string | number | null)[] = []
    constructor(readonly query: string) {}
    bind(...values: (string | number | null)[]) { this.values = values; return this }
    async first() { return sqlite.prepare(this.query).get(...this.values) ?? null }
    async all() { return { results: sqlite.prepare(this.query).all(...this.values) } }
  }
  const db = { prepare: (q: string) => new Prepared(q), async batch(statements: Prepared[]) {
    sqlite.exec('BEGIN')
    try { for (const s of statements) { sqlite.prepare(s.query).run(...s.values); if (failSQL?.test(s.query)) throw Error('Injected D1 failure') }; sqlite.exec('COMMIT'); return [] }
    catch (error) { sqlite.exec('ROLLBACK'); throw error }
  } } as unknown as D1Database
  const store = new ReviewStore(db), r2 = fakeBucket(), assets = new TrustedAssets(store, r2.bucket)
  const review = new ReviewService(store, {
    async video(id) { const row = sqlite.prepare('SELECT * FROM videos WHERE id=?').get(id); if (!row) throw Error('missing video'); return { id, legacyId: String(row.legacy_id) } },
    assertPair: (videoId, source, output) => assets.pair(videoId, source, output),
    async source(id, _actor, videoId) { const a = await assets.resolve(id, videoId, 'source'); assert.ok(a); return { checksum: a.checksum } },
    async deliverable(id, _actor, videoId) { const a = await assets.resolve(id, videoId, 'deliverable'); assert.ok(a); return { checksum: a.checksum, durationMs: a.duration_ms!, contentType: a.content_type } },
    async stageRelease(videoId, _publication, id) { const a = await assets.resolve(id, videoId, 'deliverable'); assert.ok(a); return { ...assetObject(a), contentType: a.content_type } },
    publicMediaUrl: (videoId, publicationId) => `${origin}/api/review/published-media?videoId=${videoId}&publicationId=${publicationId}`,
  })
  let alter: (evidence: ProbeResult) => void = () => {}, duringProcess: () => Promise<void> = async () => {}
  const adapter: ContainerMediaAdapter = { recipe: 'a'.repeat(64), async process(input) {
    await duringProcess()
    const checksum = await digest(outputBytes)
    const output = await r2.bucket.put(input.outputKey, stream(outputBytes), { sha256: checksum, onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'video/mp4' } }) ?? await r2.bucket.head(input.outputKey)
    const evidence: ProbeResult = { jobId: input.jobId, recipe: adapter.recipe, source: { ...input.source, contentType: 'video/mp4' }, deliverable: { key: input.outputKey, etag: output!.etag, checksum, bytes: outputBytes.length, contentType: 'video/mp4', durationMs: 10000, videoCodec: 'h264', audioCodec: 'aac', width: 1280, height: 720, fastStart: true, fullDecode: true } }
    alter(evidence); return evidence
  } }
  const intake = new ReviewIntake(store, r2.bucket, review, provider ? adapter : undefined, lengthStream, () => clock)
  const handlers = (actor = staff) => createIntakeHandlers(async () => ({ intake, actor, origin }))
  async function begin(extra = {}) { return await intake.execute(staff, { action: 'begin', commandId: crypto.randomUUID(), videoId: 10, bytes: sourceBytes.length, checksum: await digest(sourceBytes), contentType: 'video/mp4', metadata: { title: 'New cut', description: 'Reviewed media', chapters: [] }, ...extra }) as { sessionId: string; state: string; uploadUrl: string } }
  function request(id: string, body = sourceBytes, headers = {}) { return new Request(`${origin}/api/review/uploads?sessionId=${id}`, { method: 'PUT', headers: { origin, 'content-type': 'video/mp4', 'content-length': String(sourceBytes.length), ...headers }, body: body as BodyInit }) }
  async function uploaded() { const s = await begin(); await intake.upload(staff, s.sessionId, request(s.sessionId)); return s }
  const process = (id: string) => intake.execute(staff, { action: 'process', sessionId: id }) as unknown as Promise<{ revision: { revisionId: string; reviewVersion: number } }>
  return { sqlite, args, store, review, assets, r2, adapter, intake, handlers, begin, request, uploaded, process, fail: (pattern?: RegExp) => { failSQL = pattern }, tick: () => { clock += 3600 }, alter: (fn: typeof alter) => { alter = fn }, during: (fn: typeof duringProcess) => { duringProcess = fn } }
}

test('staff intake binds immutable assets, creates one revision and publishes only after client approval', async t => {
  const h = await harness(t), s = await h.uploaded(), result = await h.process(s.sessionId)
  assert.deepEqual(await h.process(s.sessionId), result)
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM video_revisions').get()?.n, 1)
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM video_publications').get()?.n, 0)
  const row = await h.review.revision(10, result.revision.revisionId, staff)
  assert.equal(row.duration_ms, 10000)
  const asset = await h.assets.resolve(row.deliverable_media_id, 10, 'deliverable'); assert.ok(asset)
  const response = await mediaResponse(new Request(origin, { headers: { range: 'bytes=2-5' } }), h.r2.bucket, asset.object_key, false, { etag: asset.object_etag, bytes: asset.bytes, contentType: asset.content_type })
  assert.equal(response.status, 206); assert.equal(await response.text(), 'code')
  const cmd = (action: string, extra: object) => ({ action, videoId: 10, commandId: crypto.randomUUID(), ...extra })
  await h.review.execute(staff, cmd('grant', { userId: 2, canApprove: true }))
  const decision = await h.review.execute(customer, cmd('decide', { revisionId: row.id, expectedReviewVersion: 1, decision: 'approved' }))
  await h.review.execute(staff, cmd('publish', { revisionId: row.id, expectedReviewVersion: 1, decisionId: decision.decisionId }))
  assert.equal(h.sqlite.prepare('SELECT object_key FROM review_publication_events').get()?.object_key, asset.object_key)
  assert.throws(() => h.sqlite.exec('UPDATE review_intake_assets SET bytes=1'), /immutable/)
  assert.throws(() => h.sqlite.exec(`UPDATE media SET filename='changed' WHERE id=${asset.media_id}`), /immutable/)
  assert.throws(() => h.sqlite.exec('DELETE FROM review_intake_assets'), /retained/)
  assert.deepEqual(h.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  assert.equal(JSON.stringify(await h.intake.read(staff, s.sessionId)).includes('review-intake/'), false)
})

test('provider absence retains verified quarantine upload and creates no revision', async t => {
  const h = await harness(t, false), s = await h.uploaded()
  assert.equal(configuredMediaAdapter(), undefined)
  await assert.rejects(h.process(s.sessionId), { status: 503 })
  assert.equal((await h.intake.read(staff, s.sessionId)).state, 'uploaded')
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM media').get()?.n, 0)
})

test('owner, role, origin, expiry, size and MIME checks run before consuming a body', async t => {
  const h = await harness(t), s = await h.begin()
  for (const actor of [customer, otherStaff]) {
    const request = h.request(s.sessionId)
    assert.equal((await h.handlers(actor).PUT(request)).status, actor === customer ? 403 : 404)
    assert.equal(request.bodyUsed, false)
  }
  for (const [headers, status] of [[{ origin: 'https://evil.example' }, 403], [{ 'content-type': 'video/webm' }, 415], [{ 'content-length': '999' }, 400]] as const) {
    const request = h.request(s.sessionId, sourceBytes, headers)
    assert.equal((await h.handlers().PUT(request)).status, status); assert.equal(request.bodyUsed, false)
  }
  await assert.rejects(h.begin({ bytes: maximumIntakeBytes + 1 }), { status: 400 })
  await assert.rejects(h.begin({ checksum: 'bad' }), { status: 400 })
  await assert.rejects(h.begin({ outputKey: 'client-controlled' }), { status: 400 })
  await assert.rejects(h.intake.execute(staff, { action: 'process', sessionId: s.sessionId, evidence: {} }), { status: 400 })
  h.tick(); const request = h.request(s.sessionId)
  assert.equal((await h.handlers().PUT(request)).status, 410); assert.equal(request.bodyUsed, false)
  assert.equal(h.r2.puts(), 0)
})

test('stream length and native checksum failures cannot register source or revision', async t => {
  for (const body of [sourceBytes.slice(1), new Uint8Array(sourceBytes.length + 1), new Uint8Array(sourceBytes.length)]) {
    const h = await harness(t), s = await h.begin()
    await assert.rejects(h.intake.upload(staff, s.sessionId, h.request(s.sessionId, body)), { status: 400 })
    assert.equal((await h.intake.read(staff, s.sessionId)).state, 'pending')
    assert.equal(h.r2.objects.size, 0)
  }
})

test('R2 success followed by D1 failure recovers without overwriting the source', async t => {
  const h = await harness(t), s = await h.begin(); h.fail(/SET state='uploaded'/)
  await assert.rejects(h.intake.upload(staff, s.sessionId, h.request(s.sessionId)), /Injected D1/)
  assert.equal(h.r2.objects.size, 1); assert.equal((await h.intake.read(staff, s.sessionId)).state, 'pending')
  h.fail(); await h.intake.upload(staff, s.sessionId, h.request(s.sessionId)); await h.intake.upload(staff, s.sessionId, h.request(s.sessionId))
  assert.equal(h.r2.puts(), 1)
  await assert.rejects(h.intake.execute(staff, { action: 'cancel', sessionId: s.sessionId }).then(() => h.process(s.sessionId)), { status: 409 })
})

test('forged or mismatched trusted-provider evidence never becomes a deliverable', async t => {
  const mutations: ((e: ProbeResult) => void)[] = [e => { e.jobId = crypto.randomUUID() }, e => { e.recipe = 'b'.repeat(64) }, e => { e.source.key = 'other/source' }, e => { e.source.etag = 'other' }, e => { e.source.checksum = 'b'.repeat(64) }, e => { e.source.bytes++ }, e => { e.source.contentType = 'video/webm' }, e => { e.deliverable.key = 'other/output' }, e => { e.deliverable.bytes++ }, e => { e.deliverable.checksum = 'b'.repeat(64) }, e => { e.deliverable.durationMs = 0 }, e => { (e.deliverable as any).fullDecode = false }]
  for (const mutate of mutations) {
    const h = await harness(t), s = await h.uploaded(); h.alter(mutate)
    await assert.rejects(h.process(s.sessionId), { status: 409 })
    assert.equal(h.sqlite.prepare('SELECT count(*) n FROM review_intake_assets').get()?.n, 0)
  }
})

test('missing R2 checksum and wrong object type are rejected independently of provider claims', async t => {
  const h = await harness(t), s = await h.uploaded()
  h.alter(e => { Object.assign(h.r2.objects.get(e.deliverable.key)!.head, { checksums: {} }) })
  await assert.rejects(h.process(s.sessionId), { status: 409 })
  const source = [...h.r2.objects.values()][0]!.head
  source.httpMetadata!.contentType = 'video/mp4'
  await assert.rejects(h.process(s.sessionId), { status: 409 })
})

test('registration transaction rolls back and retry attaches once after a lost revision write', async t => {
  const h = await harness(t), s = await h.uploaded(); h.fail(/INSERT INTO review_intake_assets/)
  await assert.rejects(h.process(s.sessionId), /Injected D1/)
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM media').get()?.n, 0)
  assert.equal((await h.intake.read(staff, s.sessionId)).state, 'processing')
  h.fail(/INSERT INTO video_revisions/); await assert.rejects(h.process(s.sessionId), /Injected D1/)
  assert.equal((await h.intake.read(staff, s.sessionId)).state, 'ready')
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM review_intake_assets').get()?.n, 2)
  h.fail(); h.tick(); await h.process(s.sessionId)
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM video_revisions').get()?.n, 1)
})

test('cancellation during encoding prevents late registration', async t => {
  const h = await harness(t), s = await h.uploaded()
  h.during(async () => { await h.intake.execute(staff, { action: 'cancel', sessionId: s.sessionId }) })
  await assert.rejects(h.process(s.sessionId), { status: 409 })
  assert.equal((await h.intake.read(staff, s.sessionId)).state, 'cancelled')
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM media').get()?.n, 0)
})

test('concurrent processing retries converge on one asset pair and revision', async t => {
  const h = await harness(t), s = await h.uploaded()
  let arrived = 0, release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  h.during(async () => { if (++arrived === 2) release(); await gate })
  const results = await Promise.allSettled([h.process(s.sessionId), h.process(s.sessionId)])
  // The revision command CAS may make one request retry, but the result is stable.
  assert.ok(results.some(r => r.status === 'fulfilled'))
  const stable = await h.process(s.sessionId)
  assert.ok(stable.revision.revisionId)
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM media').get()?.n, 2)
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM video_revisions').get()?.n, 1)
})

test('cross-video/source pairing and replacement before playback or publication fail closed', async t => {
  const h = await harness(t), first = await h.uploaded(), second = await h.uploaded()
  const a = await h.process(first.sessionId), b = await h.process(second.sessionId)
  const ra = await h.review.revision(10, a.revision.revisionId, staff), rb = await h.review.revision(10, b.revision.revisionId, staff)
  await assert.rejects(h.assets.pair(10, ra.media_id, rb.deliverable_media_id), { status: 409 })
  await assert.rejects(h.assets.resolve(ra.deliverable_media_id, 11, 'deliverable'), { status: 409 })
  await assert.rejects(h.assets.resolve(ra.media_id, 10, 'deliverable'), { status: 409 })
  const asset = await h.assets.find(ra.deliverable_media_id); assert.ok(asset)
  Object.assign(h.r2.objects.get(asset.object_key)!.head, { etag: 'replacement' })
  await assert.rejects(h.assets.resolve(ra.deliverable_media_id, 10, 'deliverable'), { status: 409 })
  await assert.rejects(mediaResponse(new Request(origin), h.r2.bucket, asset.object_key, false, { ...assetObject(asset), contentType: 'video/mp4' }), { status: 409 })
})

test('empty migration rollback succeeds and any intake record blocks destructive downgrade', async t => {
  const empty = await harness(t), populated = await harness(t)
  await migrations.at(-1)!.down(empty.args)
  await populated.begin()
  await assert.rejects(migrations.at(-1)!.down(populated.args), /CHECK constraint/)
  assert.equal(populated.sqlite.prepare('SELECT count(*) n FROM review_upload_sessions').get()?.n, 1)
})


test('begin retries recover the server-selected session; command IDs cannot cross owner or input', async t => {
  const h = await harness(t), commandId = crypto.randomUUID()
  const [a, b] = await Promise.all([h.begin({ commandId }), h.begin({ commandId })])
  assert.deepEqual(a, b)
  await assert.rejects(h.begin({ commandId, videoId: 11 }), { status: 409 })
  const saved = h.sqlite.prepare('SELECT begin_input FROM review_upload_sessions').get()!
  await assert.rejects(h.intake.execute(otherStaff, JSON.parse(String(saved.begin_input))), { status: 409 })
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM review_upload_sessions').get()?.n, 1)
})

test('durable adapter may return pending without registering media, then be polled with the same job', async t => {
  const h = await harness(t), s = await h.uploaded(), finish = h.adapter.process
  const jobs: string[] = []
  h.adapter.process = async input => { jobs.push(input.jobId); return { state: 'processing' } }
  await h.process(s.sessionId); await h.process(s.sessionId)
  assert.deepEqual(jobs, [s.sessionId, s.sessionId])
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM media').get()?.n, 0)
  h.adapter.process = finish
  assert.ok((await h.process(s.sessionId)).revision.revisionId)
})
