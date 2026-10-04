import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const base = process.env.POC_URL ?? 'http://127.0.0.1:3100'
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw new Error('Pipeline smoke test is loopback-only')
const startedAt = new Date().toISOString()
const probeResponse = await fetch(`${base}/api/poc/runtime`)
assert.ok(probeResponse.ok, 'runtime probe')
const runtimeProbe = await probeResponse.json() as { runtime: string; bindings: { D1: boolean; R2: boolean } }
assert.equal(runtimeProbe.runtime, 'Cloudflare-Workers', 'must run on actual local workerd')
assert.ok(runtimeProbe.bindings.D1 && runtimeProbe.bindings.R2, 'D1/R2 bindings present')
const credentials = JSON.parse(await readFile(new URL('../.runtime/admin.json', import.meta.url), 'utf8'))
const login = await fetch(`${base}/api/users/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.POC_EMAIL ?? credentials.email, password: process.env.POC_PASSWORD ?? credentials.password }) })
assert.equal(login.status, 200, 'local admin login')
const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
async function api(path: string, body?: unknown, method = 'POST') {
  const response = await fetch(`${base}${path}`, { method, headers: { cookie, origin:base, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await response.json() as Record<string, any>
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(json)}`)
  return json
}
async function query(id: string) {
  const response = await fetch(`${base}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query($id:String!){videoByID(id:$id){id title description chapters{title startTime}}}', variables: { id } }) })
  const json = await response.json() as Record<string, any>
  assert.equal(json.errors, undefined, JSON.stringify(json.errors))
  return json.data.videoByID
}
async function waitForReview(run: Record<string, any>) {
  let current = run
  const deadline = Date.now() + 90_000
  while (current.state !== 'awaiting-review' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    current = await api(`/api/pipeline-runs/${run.id}?depth=0`, undefined, 'GET')
  }
  assert.equal(current.state, 'awaiting-review', JSON.stringify(current))
  return current
}
async function rejectedReviewEdit(runId: number, generatedRevision: string, summary: unknown) {
  const response = await fetch(`${base}/api/poc/pipeline`, { method: 'POST', headers: { cookie, origin:base, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'edit', runId, generatedRevision, summary }) })
  assert.equal(response.status, 400, 'invalid or unavailable review edit rejected')
}
// Locally generated ffmpeg colour-and-tone clip; no customer or remote media.
const mediaBytes = await readFile(new URL('../fixtures/synthetic.mp4', import.meta.url))
const suffix = Date.now().toString(36)
const checksum = createHash('sha256').update(mediaBytes).digest('hex')
const form = new FormData()
form.set('_payload', JSON.stringify({ alt: 'Synthetic local colour-and-tone fixture; never real customer media' }))
form.set('file', new File([mediaBytes], `pipeline-fixture-${suffix}.mp4`, { type: 'video/mp4' }))
const uploaded = await fetch(`${base}/api/media`, { method: 'POST', headers: { cookie, origin:base }, body: form })
const uploadedBody = await uploaded.json() as Record<string, any>
assert.ok(uploaded.ok, JSON.stringify(uploadedBody))
const media = uploadedBody.doc
const legacyId = `pipeline-fixture-${suffix}`
const created = await api('/api/videos?draft=true', { legacyId, legacyType: 'Video', slug: legacyId, title: 'Synthetic pipeline draft', duration: 1, type: 'recorded', category: 'tutorial', _status: 'draft' })
const video = created.doc
assert.equal(await query(legacyId), null, 'new pipeline video stays private')
const registration = { action: 'register', videoId: video.id, mediaId: media.id, checksum, videoVersion: 'fixture-shared-v1', injectFailure: true }
const run = await api('/api/poc/pipeline', registration)
const duplicate = await api('/api/poc/pipeline', registration)
assert.equal(duplicate.id, run.id, 'registration is idempotent')
for (const method of ['PATCH', 'DELETE']) {
  const changeMedia = await fetch(`${base}/api/media/${media.id}`, { method, headers: { cookie, origin:base, 'content-type': 'application/json' }, body: method === 'PATCH' ? JSON.stringify({ alt: 'Attempt to change an immutable source' }) : undefined })
  assert.ok(!changeMedia.ok, `${method} cannot modify/remove immutable media records`)
}
let current = await waitForReview(run)
assert.equal(current.provider, 'deterministic-fixture')
assert.equal(current.transcriptionAttempts, 2, 'native Workflows retried the injected failure')
assert.ok(current.manifestKey)
assert.ok(current.manifestKey.includes(`/run-${run.id}/`), 'artifact namespace is run-specific')
// Same bytes, media record and version label on another video must run its own
// fail-once fixture. This catches evidence accidentally shared across runs.
const secondLegacyId = `${legacyId}-second`
const secondVideo = (await api('/api/videos?draft=true', { legacyId: secondLegacyId, legacyType: 'Video', slug: secondLegacyId, title: 'Second synthetic retry-isolation draft', duration: 1, type: 'recorded', category: 'tutorial', _status: 'draft' })).doc
const secondRun = await waitForReview(await api('/api/poc/pipeline', { ...registration, videoId: secondVideo.id }))
assert.notEqual(secondRun.id, run.id)
assert.equal(secondRun.transcriptionAttempts, 2, 'same checksum/version has independent durable attempt evidence')
assert.notEqual(secondRun.manifestKey, current.manifestKey, 'runs cannot share evidence or output artifacts')
assert.equal(await query(secondLegacyId), null)
assert.equal(await query(legacyId), null, 'workflow completion does not publish')
const bypass = await fetch(`${base}/api/videos/${video.id}`, { method: 'PATCH', headers: { cookie, origin:base, 'content-type': 'application/json' }, body: JSON.stringify({ _status: 'published' }) })
assert.ok(!bypass.ok, 'generic publishing must not bypass pipeline approval')
const staleRevision = current.generatedRevision
await rejectedReviewEdit(run.id, staleRevision, '')
await rejectedReviewEdit(run.id, staleRevision, 'x'.repeat(8001))
await rejectedReviewEdit(run.id, staleRevision, { unexpected: 'object' })
current = await api('/api/poc/pipeline', { action: 'edit', runId: run.id, generatedRevision: staleRevision, summary: 'Human-reviewed synthetic summary.' })
const stale = await fetch(`${base}/api/poc/pipeline`, { method: 'POST', headers: { cookie, origin:base, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', runId: run.id, generatedRevision: staleRevision }) })
assert.equal(stale.status, 400, 'stale approval rejected')
const approval = { action: 'approve', runId: run.id, generatedRevision: current.generatedRevision }
const approved = await api('/api/poc/pipeline', approval)
assert.equal(approved.state, 'approved')
assert.equal((await api('/api/poc/pipeline', approval)).id, run.id, 'approval retry is idempotent')
const publicVideo = await query(legacyId)
assert.equal(publicVideo.description, 'Human-reviewed synthetic summary.')
assert.equal(publicVideo.chapters[0].startTime, 0)
const implicitPublish = await fetch(`${base}/api/videos/${video.id}`, { method: 'PATCH', headers: { cookie, origin:base, 'content-type': 'application/json' }, body: JSON.stringify({ description: 'Unapproved metadata bypass attempt' }) })
assert.ok(!implicitPublish.ok, 'PATCH without _status cannot mutate an approved linked video')
assert.equal((await query(legacyId)).description, 'Human-reviewed synthetic summary.')
await rejectedReviewEdit(run.id, current.generatedRevision, 'Cannot edit an approved review')
const report = { passed: true, startedAt, finishedAt: new Date().toISOString(), runtime: 'local workerd with native Cloudflare Workflows, D1 and R2 bindings', runtimeProbe, videoId: video.id, runId: run.id, retryEvidence: [current, secondRun].map(result => ({ runId: result.id, workflowId: result.workflowId, manifestKey: result.manifestKey, transcriptionAttempts: result.transcriptionAttempts })), assertions: ['private upload and draft', 'idempotent registration', 'media PATCH/DELETE rejected', 'native retry after injected failure', 'separate runs with same checksum/version have independent durable attempt counters', 'fork/join checkpoint completion', 'bounded human edits and stale revision rejection', 'generic publish bypass rejected with or without _status', 'approved review edits rejected', 'approval exercised original R2 checksum validation', 'explicit approval reflected through compatibility GraphQL'], limitations: ['transcription/enrichment providers deterministic fixtures', 'encoding manifest is not playable media', 'Workers AI and Containers were not called', 'approval/edit operations require serialized execution; no atomic CAS', 'direct R2 mutation and checksum-mismatch rejection not exercised', 'fixture uploads limited to 2 MiB', 'no cloud deployment'] }
await mkdir(new URL('../evidence/', import.meta.url), { recursive: true })
await writeFile(new URL('../evidence/pipeline-tests.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
