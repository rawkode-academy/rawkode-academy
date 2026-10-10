import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { createCuid2 } from '../src/cuid2'
import { feedbackCsv, feedbackExport, feedbackHeaders, type FeedbackRow } from '../src/review/feedback'
import { reviewFailure } from '../src/review/http'
import { mediaResponse } from '../src/review/media'
import { createThumbnailHandlers } from '../src/review/thumbnails'
import type { ReviewActor } from '../src/review/contracts'
import { client, command, day, harness, metadata, secondClient, staff, stranger, CLIENT_ID, DELIVERABLE_MEDIA_ID, OTHER_VIDEO_ID, SECOND_CLIENT_ID, SECOND_DELIVERABLE_MEDIA_ID, SOURCE_MEDIA_ID, STAFF_ID, THUMBNAIL_ID, VIDEO_ID } from './helpers/review-harness'

type Harness = Awaited<ReturnType<typeof harness>>
const origin = 'https://preview.rawkode.academy'
const bytes = new TextEncoder().encode('private review bytes')
const bucket = {
  async head(key: string) { return { etag: 'etag', httpEtag: '"etag"', size: bytes.length, httpMetadata: { contentType: key.endsWith('.png') ? 'image/png' : 'video/mp4' } } },
  async get(_key: string, options?: R2GetOptions) {
    const range = options?.range as { offset: number; length: number } | undefined
    return { body: new Blob([range ? bytes.subarray(range.offset, range.offset + range.length) : bytes]).stream() }
  },
} as unknown as R2Bucket
const denied = { status: 404, message: 'Revision not found' }

// The private byte routes as they run in production: media/route.ts and the
// thumbnail handlers both authorize through service.revision on every request.
function routes(h: Harness, actor: ReviewActor) {
  const thumbnails = createThumbnailHandlers(async () => ({ payload: {}, store: h.store, service: h.service, actor, origin, bucket }) as never)
  async function media(request: Request) {
    try {
      const url = new URL(request.url)
      const revision = await h.service.revision(url.searchParams.get('videoId') ?? '', url.searchParams.get('revisionId') ?? '', actor)
      return await mediaResponse(request, bucket, `deliverable-${revision.deliverable_media_id}.mp4`, false, { etag: 'etag', bytes: bytes.length, contentType: 'video/mp4' })
    } catch (error) { return reviewFailure(error) }
  }
  return async (revisionId: string) => {
    const url = (path: string) => `${origin}/api/review/${path}?videoId=${VIDEO_ID}&revisionId=${revisionId}`
    return {
      'thumbnail GET': await thumbnails.GET(new Request(url('thumbnail'))),
      'thumbnail HEAD': await thumbnails.HEAD(new Request(url('thumbnail'), { method: 'HEAD' })),
      'media GET': await media(new Request(url('media'))),
      'media HEAD': await media(new Request(url('media'), { method: 'HEAD' })),
      'media Range': await media(new Request(url('media'), { headers: { range: 'bytes=0-6' } })),
    }
  }
}
async function thumbnailFixture(h: Harness) {
  h.service.dependencies.thumbnail = async () => {}
  h.sqlite.exec(`INSERT INTO media(id,filename) VALUES('${THUMBNAIL_ID}','thumb.png');
    INSERT INTO review_thumbnail_assets(media_id,video_id,checksum,object_key,object_etag,bytes,content_type) VALUES('${THUMBNAIL_ID}','${VIDEO_ID}','${'d'.repeat(64)}','thumb.png','etag',${bytes.length},'image/png')`)
}
const count = (h: Harness, sql: string, ...values: (string | number)[]) => Number(h.sqlite.prepare(sql).get(...values)?.n)

test('a grant on revision A cannot read revision B through any review surface', async t => {
  const h = await harness(t, { enforce: true })
  await thumbnailFixture(h)
  const a = await h.prepare()
  const b = await h.service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: SECOND_DELIVERABLE_MEDIA_ID, durationMs: 60000, metadata: { ...metadata, thumbnailId: THUMBNAIL_ID } }))
  const read = await h.service.read(VIDEO_ID, client)
  assert.deepEqual(read.revisions.map(revision => revision.id), [a.revisionId])
  assert.equal(read.currentRevisionId, a.revisionId, 'an unshared newer cut does not change what the client sees as current')
  assert.equal(read.canApprove, false, 'sign-off follows the real current revision')
  assert.equal(read.revisions[0]!.state, 'ready')
  await assert.rejects(h.approve(a), { status: 409, message: 'This revision is not open for sign-off; refresh the review' })
  await assert.rejects(h.service.access.require(client, VIDEO_ID, b.revisionId, 'view'), denied)
  await assert.rejects(h.service.revision(VIDEO_ID, b.revisionId, client), denied)
  for (const [name, response] of Object.entries(await routes(h, client)(b.revisionId))) {
    assert.equal(response.status, 404, name)
    assert.deepEqual(await response.json(), { error: 'Revision not found' }, name)
  }
  await assert.rejects(h.service.execute(client, command('comment', { revisionId: b.revisionId, startMs: 0, body: 'Hidden' })), denied)
  await assert.rejects(h.service.execute(client, command('decide', { revisionId: b.revisionId, expectedReviewVersion: 1, decision: 'approved' })), denied)
  await assert.rejects(feedbackExport(h.service, client, VIDEO_ID, b.revisionId), denied)

  await h.share(b.revisionId)
  for (const [name, response] of Object.entries(await routes(h, client)(b.revisionId))) assert.equal(response.status, name === 'media Range' ? 206 : 200, name)
  await h.service.execute(client, command('comment', { revisionId: b.revisionId, startMs: 0, body: 'Visible now' }))
  assert.equal((await h.service.execute(client, command('decide', { revisionId: b.revisionId, expectedReviewVersion: 1, decision: 'approved' }))).decision, 'approved')
  assert.match((await feedbackExport(h.service, client, VIDEO_ID, b.revisionId)).csv, /Visible now/)
  const after = await h.service.read(VIDEO_ID, client)
  assert.equal(after.currentRevisionId, b.revisionId)
  assert.deepEqual(after.revisions.map(revision => [revision.id, revision.canApprove, typeof revision.expiresAt]).sort(), [[a.revisionId, true, 'string'], [b.revisionId, true, 'string']].sort())
})

test('two customers on one revision see only their own and staff feedback', async t => {
  const h = await harness(t, { enforce: true }), a = await h.prepare()
  await h.share(a.revisionId, SECOND_CLIENT_ID)
  const comment = (actor: ReviewActor, body: string, startMs = 0) => h.service.execute(actor, command('comment', { revisionId: a.revisionId, startMs, body }))
  const first = await comment(client, 'First client note', 2000), second = await comment(secondClient, 'Second client secret', 1000), note = await comment(staff, 'Staff note', 3000)
  await h.service.execute(client, command('resolve-comment', { commentId: first.commentId, resolved: true }))
  await h.service.execute(secondClient, command('resolve-comment', { commentId: second.commentId, resolved: true }))
  await h.service.execute(staff, command('resolve-comment', { commentId: note.commentId, resolved: true }))
  await h.approve(a, client)
  for (const [actor, own, other] of [[client, first, second], [secondClient, second, first]] as const) {
    const read = await h.service.read(VIDEO_ID, actor)
    assert.deepEqual(read.comments.map(row => (row as { id: string }).id).sort(), [own.commentId, note.commentId].sort())
    assert.deepEqual(read.resolutions.map(row => (row as { commentId: string }).commentId).sort(), [own.commentId, note.commentId].sort())
    assert.ok(read.decisions.every(row => row.authorId === actor.id))
    assert.equal(JSON.stringify(read).includes(actor === client ? 'Second client secret' : 'First client note'), false)
    await assert.rejects(h.service.execute(actor, command('resolve-comment', { commentId: other.commentId, resolved: false })), { status: 404, message: 'Comment not found' })
    await assert.rejects(h.service.execute(actor, command('resolve-comment', { commentId: createCuid2(), resolved: false })), { status: 404, message: 'Comment not found' })
  }
  // Revision state is projected per viewer: the second client never learns of the approval.
  assert.equal((await h.service.read(VIDEO_ID, client)).revisions[0]!.state, 'approved')
  assert.equal((await h.service.read(VIDEO_ID, secondClient)).revisions[0]!.state, 'ready')
  assert.equal((await h.service.read(VIDEO_ID, secondClient)).decisions.length, 0)
  assert.equal((await h.service.list(secondClient)).items[0]!.state, 'ready')
  assert.equal((await h.service.list(client)).items[0]!.state, 'approved')
  assert.equal((await h.service.read(VIDEO_ID, staff)).revisions[0]!.state, 'approved')
  assert.equal((await h.service.read(VIDEO_ID, staff)).decisions.length, 1)
  const exported = (await feedbackExport(h.service, client, VIDEO_ID, a.revisionId)).csv
  assert.match(exported, /First client note/); assert.match(exported, /Staff note/)
  assert.doesNotMatch(exported, /Second client secret/)
  const everything = (await feedbackExport(h.service, staff, VIDEO_ID, a.revisionId)).csv
  for (const body of ['First client note', 'Second client secret', 'Staff note']) assert.match(everything, new RegExp(body))
  assert.doesNotMatch(everything, /example\.invalid/, 'exports never include email addresses')

  assert.deepEqual((await h.service.list(stranger)).items, [])
  const other = await h.service.execute(staff, command('create-revision', { videoId: OTHER_VIDEO_ID, mediaId: SOURCE_MEDIA_ID, deliverableMediaId: DELIVERABLE_MEDIA_ID, metadata }))
  await h.share(other.revisionId, SECOND_CLIENT_ID, true, 1, OTHER_VIDEO_ID)
  assert.deepEqual((await h.service.list(client)).items.map(item => item.videoId), [VIDEO_ID])
  assert.deepEqual((await h.service.list(secondClient)).items.map(item => item.videoId), [VIDEO_ID, OTHER_VIDEO_ID])
  const twin = await h.service.execute(staff, command('create-revision', { videoId: OTHER_VIDEO_ID, mediaId: SOURCE_MEDIA_ID, deliverableMediaId: SECOND_DELIVERABLE_MEDIA_ID, metadata }))
  await h.share(twin.revisionId, SECOND_CLIENT_ID, true, 1, OTHER_VIDEO_ID)
  h.sqlite.prepare('UPDATE video_revisions SET created_at=(SELECT created_at FROM video_revisions WHERE id=?) WHERE id=?').run(other.revisionId, twin.revisionId)
  const listed = (await h.service.list(secondClient)).items.filter(item => item.videoId === OTHER_VIDEO_ID)
  assert.deepEqual(listed.map(item => item.revisionId), [[other.revisionId, twin.revisionId].sort().at(-1)], 'equal timestamps still give one row per video')
})

const closed = { status: 409, message: 'This revision is not open for sign-off; refresh the review' }
const decide = (h: Harness, actor: ReviewActor, revisionId: string, decision: 'approved' | 'changes-requested') => h.service.execute(actor, command('decide', { revisionId, expectedReviewVersion: 1, decision, note: decision === 'approved' ? '' : `${actor.id} wants changes` }))
const stateFor = async (h: Harness, actor: ReviewActor) => (await h.service.read(VIDEO_ID, actor)).revisions[0]!.state

test('a second approver deciding after an approval learns nothing and their change request blocks publication', async t => {
  const h = await harness(t, { enforce: true }), a = await h.prepare()
  await h.share(a.revisionId, SECOND_CLIENT_ID)
  const first = await decide(h, client, a.revisionId, 'approved')
  const view = await h.service.read(VIDEO_ID, secondClient)
  assert.deepEqual([view.revisions[0]!.state, view.canApprove, view.decisions.length], ['ready', true, 0])
  // The second approver can still decide, exactly as if nobody had.
  await decide(h, secondClient, a.revisionId, 'changes-requested')
  assert.deepEqual([await stateFor(h, client), await stateFor(h, secondClient), await stateFor(h, staff)], ['approved', 'changes-requested', 'changes-requested'])
  assert.deepEqual((await h.service.list(staff)).items.map(item => item.state), ['changes-requested'])
  await assert.rejects(h.service.execute(staff, command('publish', { revisionId: a.revisionId, expectedReviewVersion: 1, decisionId: first.decisionId })), { status: 409, message: 'An assigned client approver has requested changes on this revision' })
  // A client's own approval is final for them; the refusal matches a stale request.
  await assert.rejects(decide(h, client, a.revisionId, 'changes-requested'), closed)
  await assert.rejects(h.service.execute(client, command('decide', { revisionId: a.revisionId, expectedReviewVersion: 9, decision: 'approved' })), closed)
  const second = await decide(h, secondClient, a.revisionId, 'approved')
  assert.equal(await stateFor(h, staff), 'approved')
  await h.service.execute(staff, command('publish', { revisionId: a.revisionId, expectedReviewVersion: 1, decisionId: second.decisionId }))
  assert.deepEqual([await stateFor(h, client), await stateFor(h, secondClient)], ['published', 'published'])
  await assert.rejects(decide(h, secondClient, a.revisionId, 'changes-requested'), closed)
})

test('an approval after another approver requested changes keeps that request visible to its author and to staff', async t => {
  const h = await harness(t, { enforce: true }), a = await h.prepare()
  await h.share(a.revisionId, SECOND_CLIENT_ID)
  await decide(h, client, a.revisionId, 'changes-requested')
  assert.equal(await stateFor(h, secondClient), 'ready')
  const approval = await decide(h, secondClient, a.revisionId, 'approved')
  const own = await h.service.read(VIDEO_ID, client)
  assert.deepEqual([own.revisions[0]!.state, own.decisions.map(row => row.decision)], ['changes-requested', ['changes-requested']])
  assert.deepEqual((await h.service.list(client)).items.map(item => item.state), ['changes-requested'])
  assert.equal(await stateFor(h, secondClient), 'approved')
  assert.equal(JSON.stringify(await h.service.read(VIDEO_ID, secondClient)).includes('2 wants changes'), false)
  assert.equal(await stateFor(h, staff), 'changes-requested')
  const publish = () => h.service.execute(staff, command('publish', { revisionId: a.revisionId, expectedReviewVersion: 1, decisionId: approval.decisionId }))
  await assert.rejects(publish(), { status: 409, message: 'An assigned client approver has requested changes on this revision' })
  // The objecting client may still change their mind; until then only staff can lift it.
  await h.service.execute(staff, command('revoke', { userId: CLIENT_ID, revisionId: a.revisionId }))
  assert.equal(await stateFor(h, staff), 'approved')
  await publish()
})

test('expiry ends access on the next request but never blocks publishing a recorded approval', async t => {
  const h = await harness(t, { enforce: true }), a = await h.prepare(), decision = await h.approve(a)
  const playback = routes(h, client)
  assert.equal((await playback(a.revisionId))['media Range'].status, 206)
  h.advance(day + 1000)
  await assert.rejects(h.service.read(VIDEO_ID, client), { status: 404 })
  assert.deepEqual((await h.service.list(client)).items, [])
  for (const name of ['media GET', 'media HEAD', 'media Range'] as const) assert.equal((await playback(a.revisionId))[name].status, 404, name)
  await assert.rejects(h.service.execute(client, command('decide', { revisionId: a.revisionId, expectedReviewVersion: 1, decision: 'changes-requested' })), { status: 404 })
  const published = await h.service.execute(staff, command('publish', { revisionId: a.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId }))
  assert.equal(published.revisionId, a.revisionId)

  const expiry = (days: number) => h.service.execute(staff, command('share', { revisionId: a.revisionId, userId: CLIENT_ID, canApprove: true, expiresAt: new Date(h.now().getTime() + days * day).toISOString() }))
  for (const days of [-1, 0, 90.01]) await assert.rejects(expiry(days), { status: 400, message: 'Choose an expiry within 90 days' })
  await assert.rejects(h.service.execute(staff, command('share', { revisionId: a.revisionId, userId: CLIENT_ID, canApprove: true, expiresAt: '2026-11-01T00:00:00+01:00' })), { status: 400 })
  await assert.rejects(h.service.execute(staff, command('share', { revisionId: a.revisionId, userId: STAFF_ID, canApprove: true, expiresAt: new Date(h.now().getTime() + day).toISOString() })), { status: 400, message: 'Choose an existing customer account' })
  assert.equal((await expiry(90)).action, 'share')
  const byDays = (fields: object) => h.service.execute(staff, command('share', { revisionId: a.revisionId, userId: CLIENT_ID, canApprove: true, ...fields }))
  const shared = await byDays({ expiresInDays: 90 })
  assert.equal(Date.parse(shared.expiresAt as string), h.now().getTime() + 90 * day, 'the server clock sets a day-based expiry')
  for (const fields of [{}, { expiresInDays: 1, expiresAt: new Date(h.now().getTime() + day).toISOString() }]) await assert.rejects(byDays(fields), { status: 400, message: 'Choose either an expiry time or a number of days' })
  for (const expiresInDays of [0, 91, 1.5]) await assert.rejects(byDays({ expiresInDays }), { status: 400, message: 'Invalid review command' })
})

test('re-sharing to extend expiry keeps the grant version and the approval publishable', async t => {
  const h = await harness(t, { enforce: true }), a = await h.prepare(), decision = await h.approve(a)
  const version = () => h.sqlite.prepare(`SELECT version FROM review_revision_grants WHERE revision_id=? AND user_id='${CLIENT_ID}'`).get(a.revisionId)?.version
  assert.equal(version(), 1)
  await h.share(a.revisionId, CLIENT_ID, true, 30)
  assert.equal(version(), 1)
  assert.match(String((await h.service.read(VIDEO_ID, client)).revisions[0]!.expiresAt), /^\d{4}-/)
  await h.service.execute(staff, command('publish', { revisionId: a.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId }))
})

test('revocation ends access on the next request, blocks replay, and voids the approval', async t => {
  const h = await harness(t, { enforce: true }), a = await h.prepare()
  const saved = command('comment', { revisionId: a.revisionId, startMs: 0, body: 'Before revocation' })
  const note = await h.service.execute(client, saved)
  await h.service.execute(staff, command('resolve-comment', { commentId: note.commentId, resolved: true }))
  const decision = await h.approve(a)
  const playback = routes(h, client)
  assert.equal((await playback(a.revisionId))['media HEAD'].status, 200)
  await h.service.execute(staff, command('revoke', { userId: CLIENT_ID, revisionId: a.revisionId }))
  for (const name of ['media HEAD', 'media Range', 'thumbnail HEAD'] as const) assert.equal((await playback(a.revisionId))[name].status, 404, name)
  await assert.rejects(h.service.execute(client, saved), { status: 404 }, 'a revoked customer cannot replay a stored result')
  await h.share(a.revisionId)
  assert.equal(h.sqlite.prepare(`SELECT version FROM review_revision_grants WHERE revision_id=? AND user_id='${CLIENT_ID}'`).get(a.revisionId)?.version, 3)
  await assert.rejects(h.service.execute(staff, command('publish', { revisionId: a.revisionId, expectedReviewVersion: 1, decisionId: decision.decisionId })), { status: 409, message: 'The approval grant changed; a new revision and decision are required' })

  const b = await h.service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: SECOND_DELIVERABLE_MEDIA_ID, durationMs: 60000, metadata }))
  await h.share(b.revisionId)
  assert.equal(count(h, `SELECT count(*) AS n FROM review_revision_grants WHERE user_id='${CLIENT_ID}' AND revoked_at IS NULL`), 2)
  const revoked = await h.service.execute(staff, command('revoke', { userId: CLIENT_ID }))
  assert.deepEqual(revoked, { action: 'revoke', userId: CLIENT_ID, revisionId: null })
  assert.equal(count(h, `SELECT count(*) AS n FROM review_revision_grants WHERE user_id='${CLIENT_ID}' AND revoked_at IS NULL`), 0)
  assert.equal(count(h, `SELECT count(*) AS n FROM review_revision_grants WHERE user_id='${CLIENT_ID}' AND revoked_by_id='${STAFF_ID}'`), 2)
  await assert.rejects(h.service.read(VIDEO_ID, client), { status: 404 })
})

test('decisions pin revision bytes and grant, and a new revision needs a fresh share and approval', async t => {
  const h = await harness(t, { enforce: true }), a = await h.prepare(), approved = await h.approve(a)
  const row = h.sqlite.prepare('SELECT * FROM review_decisions WHERE id=?').get(approved.decisionId)!
  const revision = h.sqlite.prepare('SELECT * FROM video_revisions WHERE id=?').get(a.revisionId)!
  const grant = h.sqlite.prepare(`SELECT * FROM review_revision_grants WHERE revision_id=? AND user_id='${CLIENT_ID}'`).get(a.revisionId)!
  assert.equal(row.deliverable_checksum, revision.deliverable_checksum)
  assert.equal(row.source_checksum, revision.checksum)
  assert.equal(row.grant_id, grant.id); assert.equal(row.grant_version, grant.version)
  const insert = (deliverable: string | null, grantId: string | null) => h.sqlite.prepare('INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at,deliverable_checksum,source_checksum,grant_id) VALUES(?,?,?, ?,1,1,?,?,?,?,?,?)')
    .run(createCuid2(), VIDEO_ID, a.revisionId, CLIENT_ID, 'approved', '', new Date().toISOString(), deliverable, String(revision.checksum), grantId)
  assert.throws(() => insert('f'.repeat(64), String(grant.id)), /Decision must pin/)
  assert.throws(() => insert(null, String(grant.id)), /Decision must pin/)
  assert.throws(() => insert(String(revision.deliverable_checksum), null), /Decision must pin/)

  const b = await h.service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: SECOND_DELIVERABLE_MEDIA_ID, durationMs: 60000, metadata: { ...metadata, title: 'Next cut' } }))
  await assert.rejects(h.service.execute(staff, command('publish', { revisionId: a.revisionId, expectedReviewVersion: 1, decisionId: approved.decisionId })), { status: 409 })
  const hidden = await h.service.read(VIDEO_ID, client)
  assert.deepEqual(hidden.revisions.map(item => item.id), [a.revisionId], 'clients cannot see a new cut until it is shared')
  assert.equal(hidden.currentRevisionId, a.revisionId)
  assert.equal(hidden.canApprove, false)
  assert.equal((await h.service.list(client)).items[0]!.revisionId, a.revisionId)
  await assert.rejects(h.approve(b), denied)
  const staffView = await h.service.read(VIDEO_ID, staff)
  assert.equal(staffView.revisions.find(item => item.id === b.revisionId)!.state, 'ready')
  assert.equal(staffView.decisions.filter(item => item.revisionId === b.revisionId).length, 0)
  await h.share(b.revisionId)
  const shared = (await h.service.list(client)).items[0]!
  assert.deepEqual([shared.revisionId, shared.state], [b.revisionId, 'ready'])
  assert.equal((await h.service.read(VIDEO_ID, client)).canApprove, true)
  const fresh = await h.approve(b)
  await h.service.execute(staff, command('publish', { revisionId: b.revisionId, expectedReviewVersion: 1, decisionId: fresh.decisionId }))
})

test('the commit guard rejects a grant that expires before the batch and leaves no guard rows', async t => {
  const h = await harness(t, { enforce: true }), a = await h.prepare()
  const commands = count(h, 'SELECT count(*) AS n FROM review_commands')
  h.beforeBatch(db => db.prepare("UPDATE review_revision_grants SET granted_at='2026-01-01T00:00:00.000Z', expires_at='2026-01-02T00:00:00.000Z' WHERE revision_id=?").run(a.revisionId))
  await assert.rejects(h.approve(a), { status: 409 })
  h.beforeBatch()
  assert.equal(count(h, 'SELECT count(*) AS n FROM review_decisions'), 0)
  assert.equal(count(h, 'SELECT count(*) AS n FROM review_commands'), commands)
  assert.equal(count(h, 'SELECT count(*) AS n FROM review_command_guards'), 0)
  await h.share(a.revisionId)
  await h.approve(a)
  assert.equal(count(h, 'SELECT count(*) AS n FROM review_command_guards'), 0, 'successful commands remove every guard row')
})

test('feedback CSV escapes cells, guards formulas in text cells only, and is served privately', async t => {
  const row = (data: Partial<FeedbackRow>): FeedbackRow => ({ id: 'c1', start_ms: 61500, end_ms: null, body: 'Plain', resolved: 0, resolved_at: null, created_at: '2026-10-09T00:00:00.000Z', role: 'customer', author: 'Client', ...data })
  const csv = feedbackCsv([row({ body: 'He said "hi", then\r\nleft' }), row({ id: 'c2', body: '=SUM(A1)', author: '+Mallory', start_ms: 0, end_ms: 1000, resolved: 1, resolved_at: '2026-10-09T01:00:00.000Z' })], 'rev')
  assert.ok(csv.startsWith('﻿comment_id,revision_id,start_timecode,end_timecode,start_ms,end_ms,author,author_role,created_at,resolved,resolved_at,body\r\n'))
  assert.ok(csv.endsWith('\r\n'))
  assert.ok(csv.includes('c1,rev,00:01:01.500,,61500,,Client,customer,2026-10-09T00:00:00.000Z,false,,"He said ""hi"", then\r\nleft"\r\n'))
  assert.ok(csv.includes("c2,rev,00:00:00.000,00:00:01.000,0,1000,'+Mallory,customer,2026-10-09T00:00:00.000Z,true,2026-10-09T01:00:00.000Z,'=SUM(A1)\r\n"))
  const h = await harness(t), a = await h.prepare()
  for (const [startMs, body] of [[30000, 'Later'], [1000, '-Earlier']] as const) await h.service.execute(client, command('comment', { revisionId: a.revisionId, startMs, body }))
  const exported = await feedbackExport(h.service, client, VIDEO_ID, a.revisionId)
  assert.equal(exported.filename, `review-${VIDEO_ID}-${a.revisionId}-feedback.csv`)
  const lines = exported.csv.split('\r\n')
  assert.match(lines[1]!, /,1000,,First Client,customer,.*,'-Earlier$/)
  assert.match(lines[2]!, /,30000,,First Client,customer,.*,Later$/)
  await assert.rejects(feedbackExport(h.service, client, VIDEO_ID, 'not-a-cuid2'), { status: 400 })
  const headers = new Headers(feedbackHeaders(exported.filename))
  assert.equal(headers.get('content-type'), 'text/csv; charset=utf-8')
  assert.equal(headers.get('content-disposition'), `attachment; filename="${exported.filename}"`)
  assert.equal(headers.get('cache-control'), 'private, no-store')
  assert.equal(headers.get('x-robots-tag'), 'noindex, nofollow')
})

test('only the access module names the revision grant table', async () => {
  const root = new URL('../', import.meta.url)
  const files = (await readdir(new URL('src/review/', root))).filter(name => name.endsWith('.ts')).map(name => `src/review/${name}`)
  const api = await readdir(new URL('app/(payload)/api/review/', root), { recursive: true })
  files.push(...api.filter(name => name.endsWith('route.ts')).map(name => `app/(payload)/api/review/${name}`))
  assert.ok(files.includes('src/review/access.ts') && files.includes('app/(payload)/api/review/feedback-export/route.ts'))
  for (const file of files) {
    const source = await readFile(new URL(file, root), 'utf8')
    assert.equal(source.includes('review_revision_grants'), file === 'src/review/access.ts', file)
    assert.equal(source.includes('video_review_grants'), false, file)
  }
})
