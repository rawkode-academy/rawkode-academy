import assert from 'node:assert/strict'
import test from 'node:test'
import { harness, staff, client, command, metadata } from './helpers/review-harness'
import { actorFromUser, type ReviewActor } from '../src/review/contracts'
import { broadcastCalendar, countQueueStatuses, deriveQueueStatus, listReviewQueue, needsStaff, reviewQueue, reviewQueueRow, type QueueStatusInput } from '../src/review/queue'
import { createQueueHandlers } from '../src/review/queue-http'
import { createStaffDirectoryHandlers } from '../src/review/staff-http'
import { EditorialTimes } from '../src/editorial/times'
import { formatTime } from '../src/admin/format'

const secondStaff: ReviewActor = { id: 6, collection: 'users', role: 'staff' }

test('first publication pins publishedAt across republishes; each release keeps its own time', async t => {
  const h = await harness(t)
  const first = await h.prepare()
  const published = await h.service.execute(staff, command('publish', { revisionId: first.revisionId, expectedReviewVersion: 1, decisionId: (await h.approve(first)).decisionId }))
  assert.equal(published.firstPublishedAt, published.publishedAt, 'a draft import releases first at publish time')
  const times = () => h.sqlite.prepare('SELECT published_at,source,version FROM video_editorial_times WHERE id=10').get() as { published_at: string; source: string; version: number }
  assert.deepEqual({ ...times() }, { published_at: published.publishedAt, source: 'review', version: 1 })
  assert.deepEqual(h.sqlite.prepare("SELECT action,actor,field,previous,next FROM editorial_time_events WHERE video_id=10").all().map(row => ({ ...row })), [{ action: 'publish', actor: 'user:1', field: 'publishedAt', previous: null, next: published.publishedAt }])

  const second = await h.service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 22, durationMs: 60000, metadata: { ...metadata, title: 'Second cut' } }))
  await h.share(second.revisionId)
  const again = await h.service.execute(staff, command('publish', { revisionId: second.revisionId, expectedReviewVersion: 1, decisionId: (await h.approve(second)).decisionId }))
  assert.notEqual(again.publishedAt, published.publishedAt)
  assert.equal(again.firstPublishedAt, published.publishedAt)
  assert.equal(times().published_at, published.publishedAt, 'the first release never moves')
  assert.equal(JSON.parse(String(h.sqlite.prepare('SELECT document FROM video_publications WHERE id=10').get()?.document)).publishedAt, published.publishedAt)
  assert.deepEqual(h.sqlite.prepare('SELECT published_at FROM review_publication_events WHERE video_id=10 ORDER BY published_at').all().map(row => row.published_at), [published.publishedAt, again.publishedAt])
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM editorial_time_events').get()?.n, 1)
})

test('a video imported as published keeps its git release date through review publish', async t => {
  const h = await harness(t)
  h.sqlite.exec("UPDATE videos SET _status='published',published_at='2020-01-02T00:00:00.000Z' WHERE id=11")
  const revision = await h.service.execute(staff, command('create-revision', { videoId: 11, mediaId: 20, deliverableMediaId: 21, durationMs: 60000, metadata }))
  await h.share(revision.revisionId, 2, true, 1, 11)
  const decision = await h.service.execute(client, command('decide', { videoId: 11, revisionId: revision.revisionId, expectedReviewVersion: 1, decision: 'approved' }))
  const published = await h.service.execute(staff, command('publish', { videoId: 11, revisionId: revision.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId }))
  assert.equal(published.firstPublishedAt, '2020-01-02T00:00:00.000Z')
  assert.equal(JSON.parse(String(h.sqlite.prepare('SELECT document FROM video_publications WHERE id=11').get()?.document)).publishedAt, '2020-01-02T00:00:00.000Z')
  assert.equal(h.sqlite.prepare('SELECT published_at FROM video_editorial_times WHERE id=11').get()?.published_at, '2020-01-02T00:00:00.000Z')
})

test('assign is staff only, names human staff, fences on its version and advances the generation', async t => {
  const h = await harness(t)
  h.sqlite.exec("INSERT INTO users(id,email,role,name,identity_key) VALUES(5,'rawkode-studio@system.invalid','staff','Rawkode Studio','system:rawkode-studio'),(6,'second@example.invalid','staff','Second Staff',NULL)")
  const assign = (assigneeId: number | null, expectedAssignmentVersion: number, actor = staff) => h.service.execute(actor, command('assign', { assigneeId, expectedAssignmentVersion }))
  await assert.rejects(assign(1, 0), { status: 404 }, 'no review yet')
  await h.prepare()
  await assert.rejects(assign(1, 0, client), { status: 403 })
  await assert.rejects(assign(2, 0), { status: 400 }, 'a customer is not an assignee')
  await assert.rejects(assign(5, 0), { status: 400 }, 'a system principal is not an assignee')
  const generation = () => Number(h.sqlite.prepare('SELECT generation FROM video_review_state WHERE video_id=10').get()?.generation)
  const before = generation()
  assert.deepEqual(await assign(6, 0), { assigneeId: 6, assignmentVersion: 1 })
  assert.equal(generation(), before + 1)
  await assert.rejects(assign(1, 0), { status: 409 }, 'stale version')
  assert.deepEqual(await assign(null, 1, secondStaff), { assigneeId: null, assignmentVersion: 2 })
  assert.deepEqual({ ...h.sqlite.prepare('SELECT assignee_id,version,assigned_by_id FROM review_assignments').get() }, { assignee_id: null, version: 2, assigned_by_id: 6 })
  await assign(1, 2)
  assert.deepEqual((await reviewQueue(h.store, staff, { assignee: 'me' })).items.map(item => [item.videoId, item.assignee]), [[10, { id: 1, name: 'Staff Editor' }]])
  assert.equal((await reviewQueue(h.store, secondStaff, { assignee: 'me' })).items.length, 0)
  assert.equal((await reviewQueue(h.store, staff, { assignee: 'unassigned' })).items.length, 0)
})

const input = (overrides: Partial<QueueStatusInput>): QueueStatusInput => ({ processing: false, revisionId: 'r', revisionState: 'ready', teamState: 'ready', approverCount: 1, openComments: 0, approvedDecisionId: null, ...overrides })
test('deriveQueueStatus checks processing, publication, the team outcome, then shares', () => {
	assert.equal(deriveQueueStatus(input({ processing: true, revisionState: 'published' })), 'processing')
	assert.equal(deriveQueueStatus(input({ revisionId: null })), 'no-revision')
	assert.equal(deriveQueueStatus(input({ revisionState: 'published', teamState: 'published' })), 'published')
	assert.equal(deriveQueueStatus(input({ teamState: 'changes-requested', revisionState: 'approved' })), 'changes-requested')
	assert.equal(deriveQueueStatus(input({ teamState: 'approved', revisionState: 'approved', openComments: 2, approvedDecisionId: 'd' })), 'approved-open-comments')
	assert.equal(deriveQueueStatus(input({ teamState: 'approved', revisionState: 'approved', approvedDecisionId: 'd', approverCount: 0 })), 'ready-to-publish', 'expiry alone does not void an approval')
	assert.equal(deriveQueueStatus(input({ teamState: 'ready', revisionState: 'approved' })), 'approval-invalidated')
	assert.equal(deriveQueueStatus(input({ approverCount: 0 })), 'needs-share')
	assert.equal(deriveQueueStatus(input({})), 'awaiting-client')
	const counts = countQueueStatuses([{ status: 'needs-share' }, { status: 'awaiting-client' }, { status: 'ready-to-publish' }])
	assert.equal(needsStaff(counts), 2)
})

test('the queue derives every status from real review state', async t => {
  const h = await harness(t)
  const status = async (videoId = 10) => (await reviewQueueRow(h.store, videoId))?.status
  h.sqlite.exec("INSERT INTO videos(id,legacy_id,legacy_type,slug,title,_status) VALUES(12,'empty','Video','empty','Empty','draft'); INSERT INTO video_review_state(video_id,generation) VALUES(12,1)")
  assert.equal(await status(12), 'no-revision')
  const revision = await h.service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 21, durationMs: 60000, metadata }))
  assert.equal(await status(), 'needs-share')
  await h.share(revision.revisionId)
  assert.equal(await status(), 'awaiting-client')
  await h.service.execute(client, command('decide', { revisionId: revision.revisionId, expectedReviewVersion: 1, decision: 'changes-requested' }))
  assert.equal(await status(), 'changes-requested')
  const decision = await h.approve(revision)
  const row = await reviewQueueRow(h.store, 10)
  assert.equal(row?.status, 'ready-to-publish')
  assert.equal(row?.decisionId, decision.decisionId, 'the queue hands publish the approval it will accept')
  const comment = await h.service.execute(client, command('comment', { revisionId: revision.revisionId, startMs: 0, body: 'One more thing' }))
  assert.equal(await status(), 'approved-open-comments')
  await h.service.execute(staff, command('resolve-comment', { commentId: comment.commentId, resolved: true }))
  assert.equal(await status(), 'ready-to-publish')
  // Processing counts only a live job aimed at the current revision.
  const job = (id: string, expected: string | null) => h.sqlite.exec(`INSERT INTO review_upload_sessions(id,begin_command,begin_input,owner_id,video_id,object_key,output_key,expected_bytes,expected_checksum,claimed_type,metadata,revision_command,state,created_at,expires_at) VALUES('${id}','begin-${id}','{}',1,10,'in/${id}','out/${id}',1,'c','video/mp4','{}','rev-${id}','processing',1,9999999999);
    INSERT INTO review_processing_jobs(session_id,manifest) VALUES('${id}','${JSON.stringify({ deadline: 9999999999, expectedCurrentRevisionId: expected })}')`)
  job('stale', crypto.randomUUID())
  assert.equal(await status(), 'ready-to-publish', 'a stale-expectation job is retained without replacing the cut')
  job('current', revision.revisionId)
  assert.equal(await status(), 'processing')
  h.sqlite.exec("UPDATE review_processing_jobs SET result='{}',completed_at=1 WHERE session_id='current'")
  await h.service.execute(staff, command('revoke', { userId: 2, revisionId: revision.revisionId }))
  assert.equal(await status(), 'approval-invalidated')

  const other = await h.service.execute(staff, command('create-revision', { videoId: 11, mediaId: 20, deliverableMediaId: 21, durationMs: 60000, metadata }))
  await h.share(other.revisionId, 2, true, 1, 11)
  const approved = await h.service.execute(client, command('decide', { videoId: 11, revisionId: other.revisionId, expectedReviewVersion: 1, decision: 'approved' }))
  await h.service.execute(staff, command('publish', { videoId: 11, revisionId: other.revisionId, expectedReviewVersion: 1, decisionId: approved.decisionId }))
  const page = await listReviewQueue(h.store)
  assert.deepEqual(page.items.map(item => [item.videoId, item.status]), [[10, 'approval-invalidated'], [11, 'published'], [12, 'no-revision']])
  assert.ok(page.items.find(item => item.videoId === 11)?.times.publishedAt, 'times ride along')
  assert.deepEqual((await listReviewQueue(h.store, { status: 'published' })).items.map(item => item.videoId), [11])
  const paged = await listReviewQueue(h.store, { limit: 2 })
  assert.equal(paged.nextCursor, 11)
  assert.deepEqual((await listReviewQueue(h.store, { after: paged.nextCursor!, limit: 2 })).items.map(item => item.videoId), [12])
  await assert.rejects(reviewQueue(h.store, client), { status: 403 })
})

test('the broadcast calendar lists scheduled and running live videos with or without review', async t => {
  const h = await harness(t)
  const now = new Date()
  const at = (hours: number) => new Date(now.getTime() + hours * 3600000).toISOString()
  h.sqlite.exec(`UPDATE videos SET type='live' WHERE id=10;
    INSERT INTO videos(id,legacy_id,legacy_type,slug,title,_status,type,published_at) VALUES
      (12,'legacy-upcoming','Video','legacy-upcoming','Legacy upcoming','published','live','${at(48)}'),
      (13,'legacy-past','Video','legacy-past','Legacy past','published','live','${at(-48)}'),
      (14,'recorded-future','Video','recorded-future','Recorded','draft','recorded','${at(48)}')`)
  const times = new EditorialTimes(h.store, () => now.getTime())
  await times.execute({ kind: 'user', id: 1, role: 'staff' }, { action: 'schedule', videoId: 10, commandId: crypto.randomUUID(), expectedVersion: 0, scheduledStartAt: at(2) })
  assert.deepEqual((await broadcastCalendar(h.store, () => now)).map(row => row.legacyId), ['stable-video', 'legacy-upcoming'])
  await times.execute({ kind: 'machine', name: 'studio' }, { action: 'broadcast-started', legacyId: 'legacy-past', commandId: crypto.randomUUID(), at: at(0) })
  assert.deepEqual((await broadcastCalendar(h.store, () => now)).map(row => row.legacyId), ['legacy-past', 'stable-video', 'legacy-upcoming'], 'running first')
  await times.execute({ kind: 'machine', name: 'studio' }, { action: 'broadcast-ended', legacyId: 'legacy-past', commandId: crypto.randomUUID(), at: at(0) })
  assert.deepEqual((await broadcastCalendar(h.store, () => now)).map(row => row.legacyId), ['stable-video', 'legacy-upcoming'])
})

test('queue and staff directory APIs are staff only and validate filters', async t => {
  const h = await harness(t)
  await h.prepare()
  const runtime = (actor: ReviewActor) => async () => ({ store: h.store, actor, publicationAvailable: async () => true })
  const url = (query = '') => new Request(`https://admin.rawkode.academy/api/review/queue${query}`)
  assert.equal((await createQueueHandlers(runtime(client)).GET(url())).status, 403)
  assert.equal((await createQueueHandlers(async () => ({ store: h.store, actor: actorFromUser(null) })).GET(url())).status, 401)
  for (const query of ['?status=bogus', '?assignee=abc', '?assignee=0', '?after=-1']) assert.equal((await createQueueHandlers(runtime(staff)).GET(url(query))).status, 400, query)
  const response = await createQueueHandlers(runtime(staff)).GET(url('?assignee=all'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const body = await response.json() as { items: { videoId: number; status: string; publicationAvailable: boolean }[]; broadcasts: unknown[] }
  assert.deepEqual(body.items.map(item => [item.videoId, item.status, item.publicationAvailable]), [[10, 'awaiting-client', false]])
  assert.deepEqual(body.broadcasts, [])

  const payload = { async find(options: { where: unknown }) {
    assert.deepEqual(options.where, { role: { equals: 'staff' } })
    return { docs: [{ id: 1, name: 'Staff Editor', identityKey: 'abc' }, { id: 5, name: 'Rawkode Studio', identityKey: 'system:rawkode-studio' }, { id: 6, name: '', identityKey: null }] }
  } }
  const directory = (actor: ReviewActor) => createStaffDirectoryHandlers(async () => ({ payload, store: h.store, actor, origin: '' }) as never)
  assert.equal((await directory(client).GET(url())).status, 403)
  assert.deepEqual(await (await directory(staff).GET(url())).json(), { staff: [{ id: 1, name: 'Staff Editor' }, { id: 6, name: 'Staff 6' }] })
})

test('formatTime renders absolute times with a zone name', () => {
  // Intl rejects dateStyle combined with timeZoneName, which once broke the queue view with a 500.
  assert.equal(formatTime('2099-01-02T12:00:00.000Z', 'UTC'), '2 Jan 2099, 12:00 UTC')
  assert.match(formatTime('2099-01-02T12:00:00.000Z'), /2099/)
  assert.equal(formatTime(null), 'Not set')
  assert.equal(formatTime('not a date'), 'unknown')
})
