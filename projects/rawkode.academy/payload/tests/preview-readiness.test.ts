import assert from 'node:assert/strict'
import test from 'node:test'
import { cmsPreviewReadiness } from '../src/preview-readiness'

const pullRequest = 1419
const sha = '0123456789abcdef0123456789abcdef01234567'

test('preview readiness resets a near release fixture to five minutes from now on retry', async () => {
  const now = Date.now()
  const writes: Record<string, unknown>[] = []
  const payload = {
    find: async () => ({ docs: [{ id: 'scheduled-preview', publishedAt: new Date(now + 10_000).toISOString() }] }),
    update: async ({ data }: { data: Record<string, unknown> }) => {
      writes.push(data)
      return { id: 'scheduled-preview', ...data }
    },
    create: async () => assert.fail('readiness should update its existing fixture'),
  }
  const request = new Request('https://payload.example/v1/preview/readiness', {
    method: 'POST',
    headers: { 'x-preview-pr': String(pullRequest), 'x-preview-sha': sha },
  })

  const response = await cmsPreviewReadiness(
    request,
    payload as never,
    {} as R2Bucket,
    { pullRequest, sha },
    false,
  )
  const body = await response.json() as { scheduledVideo: { publishedAt: string } }

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal(writes.length, 1)
  assert.ok(Date.parse(body.scheduledVideo.publishedAt) >= Date.now() + 4 * 60_000)
})
