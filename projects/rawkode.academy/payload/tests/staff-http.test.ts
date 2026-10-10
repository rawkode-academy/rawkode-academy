import assert from 'node:assert/strict'
import test from 'node:test'
import { createStaffReviewerHandlers, createStaffVideoHandlers } from '../src/review/staff-http'
import { ReviewError } from '../src/review/contracts'
import { createCollections } from '../src/collections'
import { isCuid2 } from '../src/cuid2'
import type { ReviewActor } from '../src/review/contracts'
import { CLIENT_ID, STAFF_ID, VIDEO_ID, OTHER_VIDEO_ID, SECOND_CLIENT_ID } from './helpers/ids'

const staff: ReviewActor = { id: STAFF_ID, collection: 'users', role: 'staff' }
const customer: ReviewActor = { id: CLIENT_ID, collection: 'users', role: 'customer' }
const origin = 'https://preview.rawkode.academy'

function runtime(actor: ReviewActor = staff, creates: Record<string, any>[] = []) {
  const payload = {
    async find(options: { collection: string }) {
      if (options.collection === 'videos') return { docs: [
        { id: VIDEO_ID, slug: 'one', title: 'One', description: 'First', tombstone: false, processingRun: null },
        { id: OTHER_VIDEO_ID, slug: 'hidden', title: 'Hidden', description: '', tombstone: true },
        { id: SECOND_CLIENT_ID, slug: 'busy', title: 'Busy', description: '', tombstone: false, processingRun: 'run-1' },
      ] }
      return { docs: [{ id: CLIENT_ID, name: 'Customer', profileEmail: 'customer@example.invalid' }] }
    },
    async create(options: { data: Record<string, unknown> }) {
      creates.push(options)
      return { ...options.data, processingRun: 'not-returned' }
    },
  }
  const store = { async all<T>() { return [{ videoId: VIDEO_ID, state: 'ready' }] as T[] } }
  return { payload, store, actor, origin } as never
}

test('staff target lookup only returns eligible videos and review state', async () => {
  const handler = createStaffVideoHandlers(async () => runtime())
  const response = await handler.GET(new Request(`${origin}/api/review/upload-targets?q=one`))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { videos: [{ videoId: VIDEO_ID, slug: 'one', title: 'One', description: 'First', reviewState: 'ready' }] })
})

test('customer accounts cannot enumerate staff upload targets or reviewers', async () => {
  const videos = createStaffVideoHandlers(async () => runtime(customer))
  const reviewers = createStaffReviewerHandlers(async () => runtime(customer))
  assert.equal((await videos.GET(new Request(`${origin}/api/review/upload-targets`))).status, 403)
  assert.equal((await reviewers.GET(new Request(`${origin}/api/review/reviewers`))).status, 403)
})

test('staff can create a private review video target without claiming import provenance', async () => {
  const creates: Record<string, any>[] = []
  const handler = createStaffVideoHandlers(async () => runtime(staff, creates))
  const response = await handler.POST(new Request(`${origin}/api/review/upload-targets`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ title: ' Datum review cut ', description: ' Private review for Datum ', _status: 'published', sourceSystem: 'legacy', processingRun: 'forged', context: { importing: true } }),
  }))
  assert.equal(response.status, 201)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(creates.length, 1)
  const options = creates[0]
  assert.equal(options.overrideAccess, false)
  assert.equal(options.draft, true)
  assert.equal(options.user, staff)
  assert.equal(options.data._status, 'draft')
  assert.equal(options.data.tombstone, false)
  for (const field of ['sourceSystem', 'sourceRevision', 'sourceHash', 'processingRun', 'context']) assert.equal(field in options.data, false)
  const videos = createCollections({} as never, {} as never).find(collection => collection.slug === 'videos')!
  assert.equal(await videos.access!.create!({ req: { user: staff, context: {} } } as never), true)
  assert.equal(await videos.access!.create!({ req: { user: customer, context: {} } } as never), false)
  assert.notEqual(await videos.access!.read!({ req: { user: customer, context: {} } } as never), true)
  const data = await videos.hooks!.beforeChange![0]!({ data: options.data, operation: 'create', req: { context: {} } } as never)
  assert.equal(data.locallyEdited, true)
  const body = await response.json() as { video: Record<string, unknown> }
  assert.equal(body.video.processingRun, undefined)
  assert.ok(isCuid2(String(body.video.videoId)), 'new editorial video targets receive a CUID2 Payload ID')
  assert.equal(body.video.title, 'Datum review cut')
  assert.equal(body.video.description, 'Private review for Datum')
  assert.equal(body.video.reviewState, 'no-review')
  assert.equal('legacyId' in body.video, false)
  assert.match(String(body.video.slug), /^review-datum-review-cut-[a-z0-9]{8}$/)
})

test('staff reviewer lookup returns only customer-facing identity fields', async () => {
  const handler = createStaffReviewerHandlers(async () => runtime())
  const response = await handler.GET(new Request(`${origin}/api/review/reviewers`))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { reviewers: [{ userId: CLIENT_ID, name: 'Customer', profileEmail: 'customer@example.invalid' }] })
})

function createRequest(body = JSON.stringify({ title: 'Datum', description: 'Review' }), headers: Record<string, string> = { origin, 'content-type': 'application/json' }) {
  return new Request(`${origin}/api/review/upload-targets`, { method: 'POST', headers, body })
}

test('target creation rejects customers, unauthenticated sessions and untrusted origins before writing', async () => {
  const creates: Record<string, any>[] = []
  assert.equal((await createStaffVideoHandlers(async () => runtime(customer, creates)).POST(createRequest())).status, 403)
  assert.equal((await createStaffVideoHandlers(async () => { throw new ReviewError(401, 'Authentication required') }).POST(createRequest())).status, 401)
  const handler = createStaffVideoHandlers(async () => runtime(staff, creates))
  for (const value of ['', 'null', 'https://evil.example']) {
    assert.equal((await handler.POST(createRequest('{}', { origin: value, 'content-type': 'application/json' }))).status, 403)
  }
  assert.equal(creates.length, 0)
})

test('target creation validates JSON, metadata and streamed byte limits before writing', async () => {
  const creates: Record<string, any>[] = []
  const handler = createStaffVideoHandlers(async () => runtime(staff, creates))
  for (const body of ['{', 'null', '[]', '{}', JSON.stringify({ title: ' ', description: 'Review' }), JSON.stringify({ title: 'x'.repeat(301), description: 'Review' }), JSON.stringify({ title: 'Datum', description: 'x'.repeat(8001) })]) {
    assert.equal((await handler.POST(createRequest(body))).status, 400)
  }
  for (const type of ['text/plain', 'application/json-invalid']) assert.equal((await handler.POST(createRequest('{}', { origin, 'content-type': type }))).status, 415)
  assert.equal((await handler.POST(createRequest(' '.repeat(16385)))).status, 413)
  assert.equal((await handler.POST(createRequest('{}', { origin, 'content-type': 'application/json', 'content-length': '16385' }))).status, 413)
  assert.equal(creates.length, 0)
})
