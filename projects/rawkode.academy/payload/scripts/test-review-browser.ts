import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

// Run against the local Astro preview UI. Identity/API are explicit fixtures;
// this checks browser behavior, not a deployed OIDC/R2 integration.
const base = process.env.REVIEW_BROWSER_URL ?? 'http://127.0.0.1:4319'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Browser fixture checks require a local UI')
const fixture = await readFile(new URL('../fixtures/synthetic.mp4', import.meta.url))
const cut = '00000000-0000-4000-8000-000000000001'
let authenticated = false, revoked = false, staff = false, stale = false, returnTo = '/review', rangeRequests = 0
let state = 'ready', version = 1
const comments: Record<string, unknown>[] = [], decisions: Record<string, unknown>[] = [], commands: Record<string, unknown>[] = []
const revision = () => ({ id: cut, reviewVersion: version, durationMs: 1000, state, createdAt: '2026-10-05T12:00:00Z', mediaUrl: `/api/review/media?videoId=10&revisionId=${cut}`, metadata: { title: 'A clearer Kubernetes demo', description: 'Please check the opening example before we publish.' } })
const review = () => ({ videoId: 10, viewerId: staff ? 1 : 2, canApprove: !staff, publicationAvailable: true, currentRevisionId: cut, revisions: [revision()], comments, decisions })
const browser = await chromium.launch({ headless: true, executablePath: process.env.REVIEW_CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } })
  page.setDefaultTimeout(15000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify(body) })
    if (url.pathname === '/api/auth/login') {
      returnTo = url.searchParams.get('returnTo') ?? '/review'
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<script>location.href="/api/auth/callback?fixture=1"</script>' })
    }
    if (url.pathname === '/api/auth/callback') {
      authenticated = true
      return route.fulfill({ status: 303, headers: { location: returnTo } })
    }
    if (url.pathname === '/api/auth/logout') { authenticated = false; return json({ signedOut: true }) }
    if (!authenticated) return json({ error: 'Sign in required' }, 401)
    if (url.pathname === '/api/auth/session') return json({ user: { id: staff ? 1 : 2, name: staff ? 'Publication editor' : 'Client reviewer', role: staff ? 'staff' : 'customer' } })
    if (url.pathname === '/api/review' && !url.searchParams.has('videoId') && request.method() === 'GET') return json({ items: revoked ? [] : [{ videoId: 10, revisionId: cut, title: revision().metadata.title, state, reviewVersion: version }], nextCursor: null })
    if (revoked) return json({ error: 'Review not found' }, 404)
    if (url.pathname === '/api/review/media') {
      const range = request.headers().range
      const match = range?.match(/^bytes=(\d+)-(\d*)$/)
      const start = match ? Number(match[1]) : 0, end = match?.[2] ? Math.min(Number(match[2]), fixture.length - 1) : fixture.length - 1
      if (match) rangeRequests++
      const headers = { 'accept-ranges': 'bytes', 'cache-control': 'private, no-store', ...(match ? { 'content-range': `bytes ${start}-${end}/${fixture.length}` } : {}) }
      return route.fulfill({ status: match ? 206 : 200, contentType: 'video/mp4', headers, body: fixture.subarray(start, end + 1) })
    }
    if (request.method() === 'POST') {
      const command = request.postDataJSON(); commands.push(command)
      if (stale) { stale = false; version++; return json({ error: 'Current review changed' }, 409) }
      if (command.action === 'comment') comments.push({ id: command.commandId, revisionId: cut, authorId: 2, startMs: command.startMs, body: command.body, resolved: 0 })
      if (command.action === 'resolve-comment') comments.find(item => item.id === command.commentId)!.resolved = command.resolved ? 1 : 0
      if (command.action === 'decide') { state = command.decision; decisions.push({ id: command.commandId, revisionId: cut, reviewVersion: command.expectedReviewVersion, decision: state, note: command.note ?? '' }) }
      if (command.action === 'publish') state = 'published'
      return json({ ok: true })
    }
    return json(review())
  })
  await page.goto(`${base}/review?videoId=10`)
  await page.getByRole('link', { name: /Sign in with Academy/ }).click()
  await page.waitForURL('**/review?videoId=10')
  await page.getByRole('heading', { name: revision().metadata.title }).waitFor()
  await page.waitForFunction(() => (document.querySelector('video')?.readyState ?? 0) >= 1)
  await page.locator('video').evaluate((video: HTMLVideoElement) => { video.currentTime = 0.5 })
  await page.waitForFunction(() => Math.abs((document.querySelector('video')?.currentTime ?? 0) - 0.5) < 0.05)
  await page.getByRole('button', { name: 'Use player time' }).click()
  await page.getByLabel('Leave a timestamped comment').fill('<img src=x onerror=alert(1)> Please hold this frame.')
  await page.getByRole('button', { name: 'Add comment', exact: true }).click()
  await page.getByText('<img src=x onerror=alert(1)> Please hold this frame.', { exact: true }).waitFor()
  assert.equal(await page.locator('.comment-body img').count(), 0)
  assert.equal(commands[0]!.startMs, 500)
  await page.getByRole('button', { name: 'Resolve comment', exact: true }).click()
  await page.getByRole('button', { name: 'Reopen comment' }).waitFor()
  await page.getByLabel('What needs to change?').fill('Make the example easier to follow.')
  await page.getByRole('button', { name: 'Request changes', exact: true }).click()
  await page.getByText('Changes requested · v1', { exact: true }).waitFor()
  stale = true
  await page.getByRole('button', { name: 'Approve this revision' }).click()
  await page.getByRole('button', { name: 'Confirm approval', exact: true }).click()
  await page.getByText(/This review changed/).waitFor()
  await page.getByRole('button', { name: 'Approve this revision' }).click()
  await page.getByRole('button', { name: 'Confirm approval', exact: true }).click()
  await page.getByRole('heading', { name: 'Approval recorded' }).waitFor()
  assert.equal(commands.at(-1)!.expectedReviewVersion, 2)
  assert.equal(commands.at(-1)!.revisionId, cut)
  assert.equal(await page.getByRole('button', { name: 'Publish approved revision' }).count(), 0)
  assert.ok(rangeRequests > 0, 'native video requested a byte range')
  await mkdir('.runtime', { recursive: true })
  await page.screenshot({ path: '.runtime/review-customer.png', fullPage: true })
  staff = true; await page.reload()
  await page.getByRole('button', { name: 'Publish approved revision' }).click()
  await page.getByRole('button', { name: 'Confirm publication', exact: true }).click()
  await page.getByRole('heading', { name: 'Published', exact: true }).waitFor()
  assert.equal(commands.at(-1)!.action, 'publish')
  assert.equal(commands.at(-1)!.decisionId, decisions.at(-1)!.id)
  revoked = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByText('Review not found', { exact: false }).waitFor()
  assert.equal(await page.locator('video').count(), 0)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('link', { name: /Sign in with Academy/ }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '.runtime/review-mobile.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: true, apiMode: 'explicit fixtures', checks: ['deep-link sign-in return', 'native private video metadata and seek', 'Range request', 'plain-text timestamp comment', 'comment resolution', 'change request', '409 refetch', 'exact revision approval', 'staff publication handoff', 'revoked view removal', 'sign-out'], rangeRequests }, null, 2))
} finally { await browser.close() }
