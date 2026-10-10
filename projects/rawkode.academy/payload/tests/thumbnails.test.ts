import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { DatabaseSync } from 'node:sqlite'
import { deflateSync } from 'node:zlib'
import test, { type TestContext } from 'node:test'
import { assertThumbnail, createThumbnailHandlers, maximumThumbnailBytes } from '../src/review/thumbnails'
import { reviewThumbnailSchema } from '../src/migrations-cuid2/cuid2_20261007_140000_review_thumbnails'
import { revisionGrantSchema } from '../src/migrations-cuid2/cuid2_20261009_130000_review_revision_grants'
import { ReviewStore } from '../src/review/store'
import { ReviewService } from '../src/review/service'
import { ReviewError, type ReviewActor } from '../src/review/contracts'
import { createCuid2 } from '../src/cuid2'
import { CLIENT_ID, OTHER_VIDEO_ID, STAFF_ID, THUMBNAIL_ID, VIDEO_ID } from './helpers/ids'

const origin = 'https://preview.rawkode.academy'
const staff: ReviewActor = { id: STAFF_ID, collection: 'users', role: 'staff' }
const customer: ReviewActor = { id: CLIENT_ID, collection: 'users', role: 'customer' }
const oldRevisionId = `r${'0'.repeat(23)}`
const newRevisionId = `n${'0'.repeat(23)}`
const wrongVideoRevisionId = `w${'0'.repeat(23)}`
function png(width = 1, height = 1) {
  function chunk(name: string, data: Buffer) {
    const type = Buffer.from(name), content = Buffer.concat([type, data])
    let crc = 0xffffffff
    for (const byte of content) { crc ^= byte; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) }
    const length = Buffer.alloc(4), check = Buffer.alloc(4)
    length.writeUInt32BE(data.length); check.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([length, content, check])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0,255,0,0]))), chunk('IEND', Buffer.alloc(0))])
}
const bytes = png()
const hash = async (data: Buffer) => Buffer.from(await crypto.subtle.digest('SHA-256', new Uint8Array(data))).toString('hex')
function request(body: Buffer = bytes, type = 'image/png', extra: Record<string, string> = {}) {
  return new Request(`${origin}/api/review/thumbnail?videoId=${VIDEO_ID}`, { method: 'POST', headers: { origin, 'content-type': type, ...extra }, body: new Uint8Array(body) })
}
function harness(t: TestContext) {
  const fixed = new Date()
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec(`PRAGMA foreign_keys=ON; CREATE TABLE videos(id TEXT PRIMARY KEY); INSERT INTO videos VALUES('${VIDEO_ID}'),('${OTHER_VIDEO_ID}'); CREATE TABLE media(id TEXT PRIMARY KEY); CREATE TABLE users(id TEXT PRIMARY KEY, role TEXT); INSERT INTO users VALUES('${STAFF_ID}','staff'),('${CLIENT_ID}','customer'); CREATE TABLE video_revisions(id TEXT PRIMARY KEY, video_id TEXT, metadata TEXT, created_at TEXT)`)
  for (const query of [...reviewThumbnailSchema, ...revisionGrantSchema]) sqlite.exec(query)
  class Prepared {
    values: (number | string | null)[] = []
    constructor(readonly query: string) {}
    bind(...values: (number | string | null)[]) { this.values = values; return this }
    async first() { return sqlite.prepare(this.query).get(...this.values) ?? null }
    async run() { return sqlite.prepare(this.query).run(...this.values) }
    async all() { return { results: sqlite.prepare(this.query).all(...this.values) } }
  }
  const store = new ReviewStore({ prepare: (query: string) => new Prepared(query) } as unknown as D1Database)
  const objects = new Map<string, { bytes: Buffer; etag: string; type: string }>()
  let heads = 0, eligible = true, corruptStorage = false
  const bucket = {
    async head(key: string) {
      heads++
      const value = objects.get(key)
      return value ? { etag: value.etag, httpEtag: `"${value.etag}"`, size: value.bytes.length, httpMetadata: { contentType: value.type } } : null
    },
    async get(key: string, options?: R2GetOptions) {
      const value = objects.get(key)
      if (!value) return null
      if (options?.onlyIf && 'etagMatches' in options.onlyIf && options.onlyIf.etagMatches !== value.etag) return { etag: value.etag }
      const range = options?.range as { offset: number; length: number } | undefined
      return { body: new Blob([new Uint8Array(range ? value.bytes.subarray(range.offset, range.offset + range.length) : value.bytes)]).stream() }
    },
  } as unknown as R2Bucket
  const creates: any[] = []
  let release: (() => void) | undefined
  let concurrent = false
  const payload = {
    async create(options: any) {
      creates.push(options)
      const id = THUMBNAIL_ID, filename = options.file.name
      const body = Buffer.from(options.file.data)
      if (corruptStorage) body[body.length - 1] ^= 1
      objects.set(filename, { bytes: body, type: options.file.mimetype, etag: await hash(body) })
      sqlite.prepare('INSERT INTO media VALUES(?)').run(id)
      if (concurrent) {
        if (creates.length === 1) await new Promise<void>(resolve => { release = resolve })
        else release?.()
      }
      return { id, filename }
    },
  }
  const service = new ReviewService(store, {
    async video(id: string) {
      if (!eligible || ![VIDEO_ID,OTHER_VIDEO_ID].includes(id)) throw new ReviewError(409, 'Ineligible video')
      return { id, legacyId: String(id) }
    },
    now: () => fixed,
  } as never)
  const handler = (actor = staff) => createThumbnailHandlers(async () => ({ payload, store, service, actor, origin, bucket }) as never)
  function revision(id: string, videoId: string, thumbnailId?: string) {
    sqlite.prepare('INSERT INTO video_revisions VALUES(?,?,?,?)').run(id, videoId, JSON.stringify(thumbnailId ? { thumbnailId } : {}), fixed.toISOString())
  }
  function share(revisionId: string, videoId: string) {
    sqlite.prepare('INSERT INTO review_revision_grants(id,video_id,revision_id,user_id,can_approve,version,granted_at,expires_at) VALUES(?,?,?,?,1,1,?,?)').run(createCuid2(), videoId, revisionId, CLIENT_ID, fixed.toISOString(), new Date(fixed.getTime() + 86400000).toISOString())
  }
  return { sqlite, share, store, objects, creates, handler, revision, heads: () => heads, ineligible: () => { eligible = false }, corrupt: () => { corruptStorage = true }, concurrent: () => { concurrent = true } }
}

test('staff thumbnail upload fixes access, verifies bytes and reuses identical upload', async t => {
  const h = harness(t), handler = h.handler()
  const response = await handler.POST(request())
  assert.equal(response.status, 201)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(await response.json(), { thumbnailId: THUMBNAIL_ID, videoId: VIDEO_ID })
  assert.equal(h.creates[0].overrideAccess, false)
  assert.equal(h.creates[0].user, staff)
  assert.equal(h.creates[0].collection, 'media')
  assert.match(h.creates[0].file.name, /^review-thumbnail-[a-z][a-z0-9]{23}\.png$/)
  const asset = await assertThumbnail(h.store, VIDEO_ID, THUMBNAIL_ID)
  assert.equal(asset.checksum, await hash(bytes))
  assert.equal(asset.bytes, bytes.length)
  const retry = await handler.POST(request())
  assert.equal(retry.status, 200)
  assert.deepEqual(await retry.json(), { thumbnailId: THUMBNAIL_ID, videoId: VIDEO_ID })
  assert.equal(h.creates.length, 1)
  await assert.rejects(assertThumbnail(h.store, OTHER_VIDEO_ID, THUMBNAIL_ID), /Thumbnail not found/)
})

test('authorization, origin and eligible video are checked before reading upload', async t => {
  const h = harness(t)
  assert.equal((await h.handler(customer).POST(request())).status, 403)
  for (const origin of ['', 'null', 'https://evil.example']) assert.equal((await h.handler().POST(request(bytes, 'image/png', { origin }))).status, 403)
  const unauthenticated = createThumbnailHandlers(async () => { throw new ReviewError(401, 'Sign in') })
  assert.equal((await unauthenticated.POST(request())).status, 401)
  h.ineligible()
  const req = request(); Object.defineProperty(req, 'body', { get() { throw Error('body must not be consumed') } })
  assert.equal((await h.handler().POST(req)).status, 409)
  assert.equal(h.creates.length, 0)
})

test('invalid MIME, truncated containers and size limits fail before Media writes', async t => {
  const h = harness(t), handler = h.handler()
  for (const type of ['text/html', 'image/svg+xml', 'image/png-invalid']) assert.equal((await handler.POST(request(bytes, type))).status, 415)
  assert.equal((await handler.POST(request(bytes, 'image/jpeg'))).status, 415)
  const corrupted = Buffer.from(bytes); corrupted[corrupted.length - 1] ^= 1
  for (const data of [Buffer.alloc(0), Buffer.from('<svg/>'), bytes.subarray(0, 24), corrupted, Buffer.from([255,216,255,217]), Buffer.from('RIFF0000WEBPVP8 ')]) {
    assert.equal((await handler.POST(request(data))).status, 400)
  }
  assert.equal((await handler.POST(request(bytes, 'image/png', { 'content-length': String(maximumThumbnailBytes + 1) }))).status, 413)
  assert.equal((await handler.POST(request(Buffer.alloc(maximumThumbnailBytes + 1)))).status, 413)
  assert.equal(h.creates.length, 0)
})

test('stored bytes must match before the thumbnail is associated', async t => {
  const h = harness(t); h.corrupt()
  assert.equal((await h.handler().POST(request())).status, 409)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_thumbnail_assets').get()!.n, 0)
})

test('customers retrieve only the selected authorized revision thumbnail, including HEAD', async t => {
  const h = harness(t); await h.handler().POST(request())
  h.revision(oldRevisionId, VIDEO_ID)
  h.revision(newRevisionId, VIDEO_ID, THUMBNAIL_ID)
  h.revision(wrongVideoRevisionId, OTHER_VIDEO_ID, THUMBNAIL_ID)
  const read = (revision: string, videoId = VIDEO_ID, method = 'GET') => h.handler(customer)[method === 'HEAD' ? 'HEAD' : 'GET'](new Request(`${origin}/api/review/thumbnail?videoId=${videoId}&revisionId=${revision}&thumbnailId=${THUMBNAIL_ID}`, { method }))
  const previousHeads = h.heads()
  assert.equal((await read(newRevisionId)).status, 404)
  assert.equal(h.heads(), previousHeads)
  h.share(oldRevisionId, VIDEO_ID)
  h.share(wrongVideoRevisionId, OTHER_VIDEO_ID)
  assert.equal((await read(newRevisionId)).status, 404, 'a grant on another revision does not expose this thumbnail')
  h.share(newRevisionId, VIDEO_ID)
  assert.equal((await read(oldRevisionId)).status, 404)
  assert.equal((await read(wrongVideoRevisionId)).status, 404)
  assert.equal((await read(wrongVideoRevisionId, OTHER_VIDEO_ID)).status, 404)
  const response = await read(newRevisionId)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('content-type'), 'image/png')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
  const head = await read(newRevisionId, VIDEO_ID, 'HEAD')
  assert.equal(head.status, 200)
  assert.equal((await head.arrayBuffer()).byteLength, 0)
  h.sqlite.exec(`UPDATE review_revision_grants SET revoked_at='${new Date().toISOString()}',version=version+1 WHERE video_id='${VIDEO_ID}'`)
  assert.equal((await read(newRevisionId)).status, 404)
})

test('changed R2 identity fails closed and association rows cannot be replaced or deleted', async t => {
  const h = harness(t); await h.handler().POST(request())
  const asset = await assertThumbnail(h.store, VIDEO_ID, THUMBNAIL_ID)
  assert.throws(() => h.sqlite.exec("UPDATE review_thumbnail_assets SET object_key='other'"), /immutable/)
  assert.throws(() => h.sqlite.exec('DELETE FROM review_thumbnail_assets'), /retained/)
  h.objects.get(asset.object_key)!.etag = 'changed'
  assert.equal((await h.handler().POST(request())).status, 409)
  h.revision(newRevisionId, VIDEO_ID, THUMBNAIL_ID)
  assert.equal((await h.handler().GET(new Request(`${origin}/api/review/thumbnail?videoId=${VIDEO_ID}&revisionId=${newRevisionId}`))).status, 409)
})

test('concurrent identical uploads choose one immutable association', async t => {
  const h = harness(t); h.concurrent()
  const responses = await Promise.all([h.handler().POST(request()), h.handler().POST(request())])
  assert.ok(responses.every(response => response.status === 201))
  const results = await Promise.all(responses.map(response => response.json()))
  assert.deepEqual(results[0], results[1])
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_thumbnail_assets').get()!.n, 1)
})

test('valid JPEG and WebP files retain their declared image type', async t => {
  // One-pixel RGB fixtures generated with sharp; production uses no native decoder.
  const fixtures = {
    'image/jpeg': '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABykX//Z',
    'image/webp': 'UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=',
  }
  for (const [type, base64] of Object.entries(fixtures)) await t.test(type, async t => {
    const h = harness(t), body = Buffer.from(base64, 'base64')
    assert.equal((await h.handler().POST(request(body, type))).status, 201)
    assert.equal(h.creates[0].file.mimetype, type)
    assert.deepEqual(h.creates[0].file.data, body)
  })
})

test('thumbnail dimension and pixel-count caps reject structurally valid headers', async t => {
  const h = harness(t)
  for (const [width, height] of [[8193, 1], [4097, 4097], [0, 1]]) {
    assert.equal((await h.handler().POST(request(png(width, height)))).status, 400)
  }
  assert.equal(h.creates.length, 0)
})
