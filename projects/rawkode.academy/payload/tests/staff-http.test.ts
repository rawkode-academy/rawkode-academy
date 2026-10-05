import assert from 'node:assert/strict'
import test from 'node:test'
import { createStaffReviewerHandlers, createStaffVideoHandlers } from '../src/review/staff-http'
import type { ReviewActor } from '../src/review/contracts'

const staff: ReviewActor = { id: 1, collection: 'users', role: 'staff' }
const customer: ReviewActor = { id: 2, collection: 'users', role: 'customer' }
const origin = 'https://preview.rawkode.academy'

function runtime(actor: ReviewActor = staff) {
  const payload = {
    async find(options: { collection: string }) {
      if (options.collection === 'videos') return { docs: [
        { id: 10, legacyId: 'one', slug: 'one', title: 'One', description: 'First', tombstone: false, processingRun: null },
        { id: 11, legacyId: 'hidden', slug: 'hidden', title: 'Hidden', description: '', tombstone: true },
        { id: 12, legacyId: 'busy', slug: 'busy', title: 'Busy', description: '', tombstone: false, processingRun: 'run-1' },
      ] }
      return { docs: [{ id: 2, name: 'Customer', profileEmail: 'customer@example.invalid' }] }
    },
  }
  const store = { async all<T>() { return [{ videoId: 10, state: 'ready' }] as T[] } }
  return { payload, store, actor } as never
}

test('staff target lookup only returns eligible videos and review state', async () => {
  const handler = createStaffVideoHandlers(async () => runtime())
  const response = await handler.GET(new Request(`${origin}/api/review/upload-targets?q=one`))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { videos: [{ videoId: 10, legacyId: 'one', slug: 'one', title: 'One', description: 'First', reviewState: 'ready' }] })
})

test('customer accounts cannot enumerate staff upload targets or reviewers', async () => {
  const videos = createStaffVideoHandlers(async () => runtime(customer))
  const reviewers = createStaffReviewerHandlers(async () => runtime(customer))
  assert.equal((await videos.GET(new Request(`${origin}/api/review/upload-targets`))).status, 403)
  assert.equal((await reviewers.GET(new Request(`${origin}/api/review/reviewers`))).status, 403)
})

test('staff reviewer lookup returns only customer-facing identity fields', async () => {
  const handler = createStaffReviewerHandlers(async () => runtime())
  const response = await handler.GET(new Request(`${origin}/api/review/reviewers`))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { reviewers: [{ userId: 2, name: 'Customer', profileEmail: 'customer@example.invalid' }] })
})
