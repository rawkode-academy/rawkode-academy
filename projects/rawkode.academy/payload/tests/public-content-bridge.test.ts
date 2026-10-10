import assert from 'node:assert/strict'
import test from 'node:test'
import { isCuid2 } from '../src/cuid2'
import { importedDocumentID, sourceIdentityData, sourceIdentityField } from '../src/importer'
import { assetResponse, collectionResponse, demoResponse, isVisibleDocument, parseCollectionRequest, parseDemoRequest, publicContentBridge } from '../src/public-content-bridge'
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
  assert.equal(parseCollectionRequest(new URL('https://payload.internal/v1/collections/chapters?slug=scheduled-chapter')), null, 'chapters are public only through their visible video parent')
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

test('exact future-live lookups keep full fields hidden until publishedAt', async () => {
  for (const lookup of [`id=${videoID}`, 'slug=future-live']) {
    const queries: Record<string, unknown>[] = []
    const payload = {
      async find(args: Record<string, unknown>) {
        queries.push(args)
        if (args.collection === 'static-assets') return { docs: [
          { id: assetID, slug: 'videos/images/cover.webp', tombstone: false, checksum: 'cover-checksum', mimeType: 'image/webp', alt: 'Live cover' },
          { id: 'b00000000000000000000000', slug: 'videos/images/full-body.png', tombstone: false, checksum: 'body-checksum', mimeType: 'image/png', alt: 'Unreleased body image' },
        ], hasNextPage: false }
        if (args.collection === 'videos') return { docs: [{
          id: videoID, slug: 'future-live', title: 'Future live show', description: 'Public metadata', type: 'live',
          publishedAt: '2026-10-11T12:00:00.000Z', streamUrl: 'https://private.invalid/stream.m3u8',
          youtubeId: 'private-video-id', podcast: { feedUrl: 'https://private.invalid/feed.xml' },
          subscribeLinks: [{ label: 'Private link', href: 'https://private.invalid/subscribe' }],
          chapters: [{ title: 'Private chapter', startTime: 30 }],
          body: 'Private scheduled body', contentResources: [{ title: 'Private resource', url: 'https://private.invalid/resource' }],
          cover: { image: './images/cover.webp' }, sourcePath: 'videos/future-live.mdx',
          sourceAssets: [
            { relativePath: 'videos/images/cover.webp' },
            { relativePath: 'videos/images/full-body.png' },
          ],
          _status: 'published', tombstone: false,
        }], hasNextPage: false }
        if (args.collection === 'video-publications') return { docs: [], hasNextPage: false }
        return { docs: [], hasNextPage: false }
      },
    }
    const response = await collectionResponse(new Request(`https://payload.internal/v1/collections/videos?${lookup}`), payload as never, now)
    const body = await response.json() as { doc?: Record<string, unknown> }
    assert.equal(response.status, 200)
    assert.equal(body.doc?.title, 'Future live show')
    assert.equal(body.doc?.publishedAt, '2026-10-11T12:00:00.000Z')
    for (const field of ['body', 'chapters', 'contentResources', 'subscribeLinks', 'streamUrl', 'youtubeId', 'podcast']) {
      assert.equal(field in (body.doc ?? {}), false, `future live exact ${lookup} must not expose ${field}`)
    }
    assert.deepEqual(body.doc?.mediaAssets, [{ relativePath: 'images/cover.webp', assetId: assetID, checksum: 'cover-checksum', mimeType: 'image/webp', alt: 'Live cover' }])
    const assetQuery = queries.find(query => query.collection === 'static-assets')
    assert.equal(JSON.stringify(assetQuery?.where).includes('full-body.png'), false, `future live exact ${lookup} must not resolve unreleased body assets`)
    assert.equal(JSON.stringify(body).includes('private.invalid'), false)
  }
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

test('published review chapter edits replace the imported chapter relation in full video projections', async () => {
  const payload = { async find(args: Record<string, unknown>) {
    if (args.collection === 'videos') return { docs: [{
      id: videoID, slug: 'chapter-video', chapters: [{ title: 'Imported chapter', startTime: 0 }],
      _status: 'published', tombstone: false,
    }], hasNextPage: false }
    if (args.collection === 'video-publications') return { docs: [{ id: videoID, document: {
      id: videoID, slug: 'chapter-video', _status: 'published', tombstone: false,
      reviewChapters: [
        { title: 'Edited intro', startTime: 0, legacyId: `${videoID}-revision-0` },
        { title: 'Edited details', startTime: 75, legacyId: `${videoID}-revision-1` },
      ],
    } }], hasNextPage: false }
    return { docs: [], hasNextPage: false }
  } }
  const response = await collectionResponse(new Request(`https://payload.internal/v1/collections/videos?id=${videoID}`), payload as never, now)
  const body = await response.json() as { doc: Record<string, unknown> }
  assert.deepEqual(body.doc.chapters, [
    { title: 'Edited intro', startTime: 0 },
    { title: 'Edited details', startTime: 75 },
  ])
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

test('demo bridge returns only the selected inline demo from a visible course module', async () => {
  const queries: Record<string, unknown>[] = []
  const selectedFiles = { 'package.json': '{"scripts":{"dev":"node server.js"}}', 'server.js': 'console.log("selected demo")' }
  const hiddenFiles = { 'secret.js': 'must not be returned' }
  const payload = { async find(args: Record<string, unknown>) {
    queries.push(args)
    if (args.collection === 'courses') return { docs: [{ id: 'course-id', slug: 'demo-course', _status: 'published', tombstone: false }], hasNextPage: false }
    if (args.collection === 'course-modules') return { docs: [{
      id: 'module-id', slug: 'demo-course/01-intro', course: 'course-id', _status: 'published', tombstone: false,
      contentResources: [
        { id: 'selected-resource-id', type: 'embed', title: 'Selected', description: 'Selected bounded demo', embedConfig: { container: 'webcontainer', src: 'selected-demo', startCommand: 'node server.js', files: selectedFiles } },
        { id: 'no-command-id', type: 'embed', title: 'No command', embedConfig: { container: 'webcontainer', src: 'no-command-demo', files: selectedFiles } },
        { type: 'embed', title: 'Other', embedConfig: { container: 'webcontainer', src: 'other-demo', startCommand: 'node secret.js', files: hiddenFiles } },
      ],
    }], hasNextPage: false }
    return { docs: [], hasNextPage: false }
  } }
  const request = new Request('https://payload.internal/v1/demos?course=demo-course&module=demo-course%2F01-intro&resource=selected-demo')
  const response = await publicContentBridge(request, payload as never, {} as never)
  const body = await response.json() as Record<string, unknown>
  assert.equal(response.status, 200)
  assert.deepEqual(body, { title: 'Selected', description: 'Selected bounded demo', files: selectedFiles, startCommand: 'node server.js' })
  assert.equal(JSON.stringify(body).includes('must not be returned'), false)
  assert.match(response.headers.get('Cache-Control') ?? '', /s-maxage=30/)
  const byID = await demoResponse(new Request('https://payload.internal/v1/demos?course=demo-course&module=demo-course%2F01-intro&resource=selected-resource-id'), payload as never, now)
  assert.deepEqual(await byID.json(), body)
  const optionalCommand = await demoResponse(new Request('https://payload.internal/v1/demos?course=demo-course&module=demo-course%2F01-intro&resource=no-command-demo'), payload as never, now)
  assert.deepEqual(await optionalCommand.json(), { title: 'No command', files: selectedFiles })
  const moduleQuery = queries.find(query => query.collection === 'course-modules') as Record<string, unknown>
  assert.deepEqual(moduleQuery.select, { id: true, slug: true, course: true, _status: true, tombstone: true, publishedAt: true, contentResources: true })
  assert.equal(JSON.stringify(moduleQuery.where).includes('course-id'), true)
})

test('demo bridge rejects scheduled modules until their publication boundary', async () => {
  let moduleReads = 0
  const releaseAt = new Date(now + 5_000).toISOString()
  const payload = { async find(args: Record<string, unknown>) {
    if (args.collection === 'courses') return { docs: [{ id: 'course-id', slug: 'demo-course', _status: 'published', tombstone: false }], hasNextPage: false }
    if (args.collection === 'course-modules') {
      moduleReads += 1
      return { docs: [{ id: 'module-id', slug: 'demo-course/01-intro', course: 'course-id', _status: 'published', tombstone: false, publishedAt: releaseAt, contentResources: [{ type: 'embed', embedConfig: { container: 'webcontainer', src: 'selected-demo', startCommand: 'node server.js', files: { 'server.js': 'future private code' } } }] }], hasNextPage: false }
    }
    return { docs: [], hasNextPage: false }
  } }
  const response = await demoResponse(new Request('https://payload.internal/v1/demos?course=demo-course&module=demo-course%2F01-intro&resource=selected-demo'), payload as never, now)
  assert.equal(response.status, 404)
  assert.equal(moduleReads, 1)
  assert.match(response.headers.get('Cache-Control') ?? '', /s-maxage=5/)
  assert.equal((await response.text()).includes('future private code'), false)
})

test('demo request accepts only matching course/module/resource slugs', () => {
  const valid = parseDemoRequest(new URL('https://payload.internal/v1/demos?course=demo-course&module=demo-course%2F01-intro&resource=selected-demo'))
  assert.deepEqual(valid, { course: 'demo-course', module: 'demo-course/01-intro', resource: 'selected-demo' })
  assert.throws(() => parseDemoRequest(new URL('https://payload.internal/v1/demos?course=demo-course&module=other-course%2F01-intro&resource=demo')))
  assert.throws(() => parseDemoRequest(new URL('https://payload.internal/v1/demos?course=demo-course&module=demo-course%2F..%2Fsecret&resource=demo')))
  assert.throws(() => parseDemoRequest(new URL('https://payload.internal/v1/demos?course=demo-course&module=demo-course%2F01-intro&resource=demo&collection=videos')))
})

test('full module projection omits inline demo files outside the selected demo route', async () => {
  const payload = { async find(args: Record<string, unknown>) {
    if (args.collection === 'course-modules') return { docs: [{ id: 'module-id', slug: 'demo-course/01-intro', title: 'Intro', _status: 'published', tombstone: false, contentResources: [{ type: 'embed', title: 'Demo', embedConfig: { container: 'webcontainer', src: 'sample', import: { localDir: '../../private/path' }, files: { 'server.js': 'inline source' } } }] }], hasNextPage: false }
    return { docs: [], hasNextPage: false }
  } }
  const response = await collectionResponse(new Request('https://payload.internal/v1/collections/course-modules?slug=demo-course%2F01-intro'), payload as never, now)
  const body = await response.json() as { doc: { contentResources: Record<string, unknown>[] } }
  const embedConfig = body.doc.contentResources[0]?.embedConfig as Record<string, unknown>
  assert.equal('files' in embedConfig, false)
  assert.equal('import' in embedConfig, false)
})

test('full video projections restore ordered chapter objects from Payload relations', async () => {
  let chapterQuery: Record<string, unknown> | undefined
  const payload = { async find(args: Record<string, unknown>) {
    if (args.collection === 'videos') return { docs: [{
      id: videoID, slug: 'chapter-video', chapters: ['chapter-b', 'chapter-a', 'chapter-draft'],
      _status: 'published', tombstone: false,
    }], hasNextPage: false }
    if (args.collection === 'video-publications') return { docs: [], hasNextPage: false }
    if (args.collection === 'chapters') {
      chapterQuery = args
      return { docs: [
      { id: 'chapter-a', title: 'Second', startTime: 60, _status: 'published', tombstone: false },
      { id: 'chapter-b', title: 'First', startTime: 0, _status: 'published', tombstone: false },
      { id: 'chapter-draft', title: 'Draft', startTime: 120, _status: 'draft', tombstone: false },
      ], hasNextPage: false }
    }
    return { docs: [], hasNextPage: false }
  } }
  const response = await collectionResponse(new Request('https://payload.internal/v1/collections/videos?slug=chapter-video'), payload as never, now)
  const body = await response.json() as { doc: { chapters: unknown[] } }
  assert.deepEqual(body.doc.chapters, [
    { title: 'First', startTime: 0 },
    { title: 'Second', startTime: 60 },
  ])
  assert.equal(JSON.stringify(chapterQuery?.where).includes('published'), true)
  assert.equal(JSON.stringify(chapterQuery?.where).includes('tombstone'), true)
})

test('asset bridge streams published objects without returning the R2 key', async () => {
  let requestedKey = ''
  const checksum = 'a'.repeat(64)
  const sourcePath = 'videos/images/cover.webp'
  const key = `static/${checksum.slice(0, 16)}/${sourcePath}`
  const payload = { async findByID() { return { id: assetID, slug: sourcePath, tombstone: false, r2Key: key, mimeType: 'image/webp', checksum, bytes: 4 } } }
  const bucket = { async get(requested: string) { requestedKey = requested; return { body: new Blob(['data']).stream(), size: 4, customMetadata: { checksum, sourcePath }, httpMetadata: { contentType: 'image/webp' } } } }
  const response = await assetResponse(new Request(`https://payload.internal/v1/assets/${assetID}`), payload as never, bucket as never, now)
  assert.equal(response.status, 200)
  assert.equal(requestedKey, key)
  assert.equal(response.headers.get('ETag'), `"${checksum}"`)
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

test('asset bridge refuses private R2 namespaces before reading their objects', async () => {
  let reads = 0
  const checksum = 'b'.repeat(64)
  const sourcePath = 'videos/private.mp4'
  const payload = { async findByID() { return { id: assetID, slug: sourcePath, tombstone: false, r2Key: 'review-intake/private-upload', mimeType: 'video/mp4', checksum, bytes: 4 } } }
  const bucket = { async get() { reads++; return { body: new Blob(['data']).stream(), size: 4, customMetadata: { checksum, sourcePath }, httpMetadata: { contentType: 'video/mp4' } } } }
  const response = await assetResponse(new Request(`https://payload.internal/v1/assets/${assetID}`), payload as never, bucket as never, now)
  assert.equal(response.status, 404)
  assert.equal(reads, 0)
})

test('asset bridge requires imported R2 metadata to match the static asset document', async () => {
  const checksum = 'c'.repeat(64)
  const sourcePath = 'videos/images/cover.webp'
  const payload = { async findByID() { return { id: assetID, slug: sourcePath, tombstone: false, r2Key: `static/${checksum.slice(0, 16)}/${sourcePath}`, mimeType: 'image/webp', checksum, bytes: 4 } } }
  const bucket = { async get() { return { body: new Blob(['data']).stream(), size: 4, customMetadata: { checksum: 'd'.repeat(64), sourcePath }, httpMetadata: { contentType: 'image/webp' } } } }
  const response = await assetResponse(new Request(`https://payload.internal/v1/assets/${assetID}`), payload as never, bucket as never, now)
  assert.equal(response.status, 404)
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
