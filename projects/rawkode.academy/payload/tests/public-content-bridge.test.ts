import assert from 'node:assert/strict'
import test from 'node:test'
import { isCuid2 } from '../src/cuid2'
import { importedDocumentID, sourceIdentityData, sourceIdentityField } from '../src/importer'
import { assetResponse, collectionResponse, isVisibleDocument, parseCollectionRequest, publicContentBridge } from '../src/public-content-bridge'
import { d2SourceHash, diagramObjectKey, normalizeD2Source } from '../src/diagrams'

const videoID = 'v00000000000000000000000'
const assetID = 'a00000000000000000000000'
const now = Date.parse('2026-10-10T12:00:00.000Z')

test('bridge accepts only the bounded fixed collection query contract', () => {
  const list = parseCollectionRequest(new URL('https://payload.internal/v1/collections/videos'))
  assert.equal(list?.view, 'summary')
  assert.equal(list?.limit, 50)
  const detail = parseCollectionRequest(new URL('https://payload.internal/v1/collections/videos?slug=example'))
  assert.equal(detail?.view, 'full')
  assert.equal(detail?.slug, 'example')
  assert.throws(() => parseCollectionRequest(new URL('https://payload.internal/v1/collections/videos?where[title][like]=x')))
  assert.throws(() => parseCollectionRequest(new URL('https://payload.internal/v1/collections/videos?q=x&limit=51')))
  assert.throws(() => parseCollectionRequest(new URL('https://payload.internal/v1/collections/articles?showId=show')))
  assert.equal(parseCollectionRequest(new URL('https://payload.internal/v1/collections/users')), null, 'collections outside the public route allowlist are not routed')
})

test('central visibility hides drafts, tombstones and future recorded videos but exposes metadata-only live videos', () => {
  assert.deepEqual(isVisibleDocument('videos', { _status: 'draft', tombstone: false, type: 'live', publishedAt: '2026-10-11T00:00:00.000Z' }, now), { visible: false, metadataOnly: false })
  assert.deepEqual(isVisibleDocument('videos', { _status: 'published', tombstone: true, type: 'recorded' }, now), { visible: false, metadataOnly: false })
  assert.deepEqual(isVisibleDocument('videos', { _status: 'published', tombstone: false, type: 'recorded', publishedAt: '2026-10-11T00:00:00.000Z' }, now), { visible: false, metadataOnly: false })
  assert.deepEqual(isVisibleDocument('videos', { _status: 'published', tombstone: false, type: 'live', publishedAt: '2026-10-11T00:00:00.000Z' }, now), { visible: true, metadataOnly: true })
})

test('video Payload ID is the preserved CUID2 R2 content ID', () => {
  const existingID = 'r00000000000000000000000'
  assert.equal(importedDocumentID('videos', videoID), videoID)
  assert.equal(isCuid2(importedDocumentID('videos', videoID)), true)
  assert.equal(importedDocumentID('articles', 'article-slug', existingID), existingID)
  const generated = importedDocumentID('articles', 'new-article')
  assert.equal(isCuid2(generated), true)
  assert.equal(sourceIdentityField('videos'), 'id')
  assert.deepEqual(sourceIdentityData('videos', videoID), {})
  assert.equal(sourceIdentityField('articles'), 'legacyId')
})

test('summary response projects card media and hides provenance and future-live playback fields', async () => {
  const queries: Record<string, unknown>[] = []
  const payload = {
    async find(args: Record<string, unknown>) {
      queries.push(args)
      if (args.collection === 'static-assets') return { docs: [{ id: assetID, slug: 'videos/images/cover.webp', tombstone: false, checksum: 'sha256-cover', mimeType: 'image/webp', alt: 'Live cover', r2Key: 'secret/r2/key' }], hasNextPage: false }
      if (args.collection === 'video-publications') return { docs: [], hasNextPage: false }
      if (args.sort === 'publishedAt') return { docs: [{ id: videoID, type: 'live', publishedAt: '2026-10-11T12:00:00.000Z' }], hasNextPage: false }
      if (args.collection === 'videos') return { docs: [{
        id: videoID, slug: 'future-live', title: 'Future live show', description: 'Public metadata', type: 'live',
        publishedAt: '2026-10-11T12:00:00.000Z', streamUrl: 'https://private.invalid/stream.m3u8', youtubeId: 'private-id',
        cover: { image: './images/cover.webp' }, terms: [{ id: 'term-row-private-id', _order: 1, value: 'Cloud Native' }], sourcePath: 'videos/future-live.mdx',
        sourceAssets: [{ relativePath: 'videos/images/cover.webp', r2Key: 'secret/r2/key', checksum: 'sha256-cover' }],
        _status: 'published', tombstone: false,
      }], hasNextPage: false }
      return { docs: [], hasNextPage: false }
    },
  }
  const response = await collectionResponse(new Request('https://payload.internal/v1/collections/videos'), payload as never, now)
  const body = await response.json() as { docs: Record<string, unknown>[]; nextReleaseAt: string }
  assert.equal(response.status, 200)
  assert.equal(body.nextReleaseAt, '2026-10-11T12:00:00.000Z')
  assert.match(response.headers.get('Cache-Control') ?? '', /s-maxage=30/)
  assert.match(response.headers.get('Cache-Control') ?? '', /stale-while-revalidate=0/)
  const doc = body.docs[0]!
  assert.equal(doc.id, videoID)
  assert.equal('contentId' in doc, false)
  assert.equal(doc.slug, 'future-live')
  assert.deepEqual(doc.terms, ['Cloud Native'], 'array row ids are removed while authored values remain')
  assert.equal('streamUrl' in doc, false)
  assert.equal('youtubeId' in doc, false)
  assert.equal('legacyId' in doc, false)
  assert.equal('sourcePath' in doc, false)
  assert.deepEqual(doc.mediaAssets, [{ relativePath: 'images/cover.webp', assetId: assetID, checksum: 'sha256-cover', mimeType: 'image/webp', alt: 'Live cover' }])
  assert.equal(JSON.stringify(body).includes('secret/r2/key'), false)
  const listQuery = queries.find(query => query.collection === 'videos' && query.sort !== 'publishedAt')!
  assert.equal((listQuery.select as Record<string, unknown>).body, undefined, 'summary does not load body')
  assert.equal((listQuery.select as Record<string, unknown>).sourceAssets, true, 'internal asset provenance is read only to derive public mediaAssets')
  const assetQuery = queries.find(query => query.collection === 'static-assets')!
  assert.equal(JSON.stringify(assetQuery.where).includes('_status'), false, 'static-assets has no draft status column')
})

test('scheduled release cache lifetime ends at the publishedAt boundary', async () => {
  const releaseAt = new Date(now + 1500).toISOString()
  const payload = {
    async find(args: Record<string, unknown>) {
      if (args.collection === 'videos' && args.sort === 'publishedAt') return { docs: [{ id: videoID, publishedAt: releaseAt, type: 'recorded' }], hasNextPage: false }
      if (args.collection === 'videos') return { docs: [], hasNextPage: false }
      if (args.collection === 'video-publications') return { docs: [], hasNextPage: false }
      return { docs: [], hasNextPage: false }
    },
  }
  const response = await collectionResponse(new Request('https://payload.internal/v1/collections/videos'), payload as never, now)
  const body = await response.json() as { nextReleaseAt: string | null }
  assert.equal(body.nextReleaseAt, releaseAt)
  assert.match(response.headers.get('Cache-Control') ?? '', /s-maxage=1/)
  assert.match(response.headers.get('Cache-Control') ?? '', /stale-while-revalidate=0/)
})

test('published video overlay is applied after base visibility and remains explicitly projected', async () => {
  const queries: Record<string, unknown>[] = []
  const payload = {
    async find(args: Record<string, unknown>) {
      queries.push(args)
      if (args.collection === 'videos') return { docs: [{ id: videoID, slug: 'video', title: 'Draft title', publishedAt: '2026-10-01T00:00:00.000Z', type: 'recorded', _status: 'published', tombstone: false }], hasNextPage: false }
      if (args.collection === 'video-publications') return { docs: [{ id: videoID, document: { id: videoID, slug: 'video', title: 'Approved release', streamUrl: 'https://cdn.invalid/release.m3u8', _status: 'published', tombstone: false, publishedAt: '2026-10-09T00:00:00.000Z', r2Key: 'private-key' } }], hasNextPage: false }
      return { docs: [], hasNextPage: false }
    },
  }
  const response = await collectionResponse(new Request(`https://payload.internal/v1/collections/videos?id=${videoID}`), payload as never, now)
  const body = await response.json() as { doc: Record<string, unknown> }
  assert.equal(body.doc.title, 'Approved release')
  assert.equal(body.doc.id, videoID)
  assert.equal('contentId' in body.doc, false)
  assert.equal(body.doc.streamUrl, 'https://cdn.invalid/release.m3u8')
  assert.equal('r2Key' in body.doc, false)
  const publicationRead = queries.find(query => query.collection === 'video-publications')!
  assert.equal(publicationRead.overrideAccess, true, 'only the bounded bridge bypasses staff-only collection REST access')
  assert.equal(publicationRead.user, null)
})

test('full content projections include authored contentResources', async () => {
  for (const [collection, slug] of [['videos', 'video'], ['articles', 'article'], ['courses', 'course'], ['course-modules', 'module']] as const) {
    const contentResources = [{ title: 'Reference', url: 'https://example.invalid/reference' }]
    const queries: Record<string, unknown>[] = []
    const payload = { async find(args: Record<string, unknown>) {
      queries.push(args)
      if (args.collection === collection) return { docs: [{ id: videoID, slug, title: slug, contentResources, _status: 'published', tombstone: false }], hasNextPage: false }
      return { docs: [], hasNextPage: false }
    } }
    const response = await collectionResponse(new Request(`https://payload.internal/v1/collections/${collection}?slug=${slug}`), payload as never, now)
    const body = await response.json() as { doc: Record<string, unknown> }
    assert.deepEqual(body.doc.contentResources, contentResources)
    assert.equal((queries.find(query => query.collection === collection)?.select as Record<string, unknown>).contentResources, true)
  }
})

test('full video projections restore ordered chapter objects from Payload relations', async () => {
  const payload = { async find(args: Record<string, unknown>) {
    if (args.collection === 'videos') return { docs: [{
      id: videoID, slug: 'chapter-video', chapters: ['chapter-b', 'chapter-a', 'chapter-draft'],
      _status: 'published', tombstone: false,
    }], hasNextPage: false }
    if (args.collection === 'video-publications') return { docs: [], hasNextPage: false }
    if (args.collection === 'chapters') return { docs: [
      { id: 'chapter-a', title: 'Second', startTime: 60, _status: 'published', tombstone: false },
      { id: 'chapter-b', title: 'First', startTime: 0, _status: 'published', tombstone: false },
      { id: 'chapter-draft', title: 'Draft', startTime: 120, _status: 'draft', tombstone: false },
    ], hasNextPage: false }
    return { docs: [], hasNextPage: false }
  } }
  const response = await collectionResponse(new Request('https://payload.internal/v1/collections/videos?slug=chapter-video'), payload as never, now)
  const body = await response.json() as { doc: { chapters: unknown[] } }
  assert.deepEqual(body.doc.chapters, [
    { title: 'First', startTime: 0 },
    { title: 'Second', startTime: 60 },
  ])
})

test('asset bridge streams published objects without returning the R2 key', async () => {
  let requestedKey = ''
  const payload = { async findByID() { return { id: assetID, tombstone: false, r2Key: 'private/r2/key', mimeType: 'image/webp', checksum: 'sha256-cover', bytes: 4 } } }
  const bucket = { async get(key: string) { requestedKey = key; return { body: new Blob(['data']).stream() } } }
  const response = await assetResponse(new Request(`https://payload.internal/v1/assets/${assetID}`), payload as never, bucket as never, now)
  assert.equal(response.status, 200)
  assert.equal(requestedKey, 'private/r2/key')
  assert.equal(response.headers.get('ETag'), '"sha256-cover"')
  assert.equal(await response.text(), 'data')
  assert.equal(response.headers.has('r2Key'), false)
})

test('asset bridge denies draft and tombstoned assets before reading their R2 objects', async () => {
  let reads = 0
  const payload = { async findByID() { return { id: assetID, _status: 'draft', tombstone: false, r2Key: 'private/r2/key' } } }
  const bucket = { async get() { reads++; return { body: new Blob(['secret']).stream() } } }
  const response = await assetResponse(new Request(`https://payload.internal/v1/assets/${assetID}`), payload as never, bucket as never, now)
  assert.equal(response.status, 404)
  assert.equal(reads, 0)
  assert.equal(isVisibleDocument('static-assets', { tombstone: false }).visible, true)
  assert.equal(isVisibleDocument('static-assets', { _status: 'draft', tombstone: false }).visible, false)
  assert.equal(isVisibleDocument('static-assets', { tombstone: true }).visible, false)
})

test('diagram bridge serves only checksum-addressed derived SVG bytes', async () => {
  const sourceHash = await d2SourceHash('x -> y')
  const svgChecksum = 'b'.repeat(64)
  const requested: string[] = []
  const bucket = { async get(key: string) { requested.push(key); return { body: new Blob(['<svg></svg>']).stream(), customMetadata: { sourceChecksum: sourceHash, svgChecksum } } } }
  const response = await publicContentBridge(new Request(`https://payload.internal/v1/diagrams/${sourceHash}.svg`), {} as never, bucket as never)
  assert.equal(response.status, 200)
  assert.deepEqual(requested, [diagramObjectKey(sourceHash)])
  assert.equal(response.headers.get('X-Source-Checksum'), sourceHash)
  assert.equal(response.headers.get('X-Content-Checksum'), svgChecksum)
  assert.equal(response.headers.get('ETag'), `"${svgChecksum}"`)
  assert.equal(await response.text(), '<svg></svg>')
  assert.equal(normalizeD2Source('  x -> y\r\n'), 'x -> y')
  const invalid = await publicContentBridge(new Request(`https://payload.internal/v1/diagrams/${sourceHash}.svg?other=1`), {} as never, bucket as never)
  assert.equal(invalid.status, 404)
})
