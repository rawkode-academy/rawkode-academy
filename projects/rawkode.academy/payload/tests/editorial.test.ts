import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { harness, staff, client, command } from './helpers/review-harness'
import { EditorialTimes } from '../src/editorial/times'
import { canonicalTime, effectiveTimes } from '../src/editorial/effective'
import { createEditorialHandlers, createEditorialMachineHandlers, EDITORIAL_BROADCAST_PATH } from '../src/editorial/http'
import type { EditorialActor } from '../src/editorial/contracts'
import { videoDeleteGuard } from '../src/editorial/delete-guard'
import * as editorialMigration from '../src/migrations/20261009_150000_editorial_times'
import { signMachineRequest } from '../src/machine-auth'
import { ReviewError } from '../src/review/contracts'

const clock = Date.parse('2026-10-09T12:00:00.000Z')
const iso = (offsetMs: number) => new Date(clock + offsetMs).toISOString()
const minute = 60_000
const staffActor: EditorialActor = { kind: 'user', id: 1, role: 'staff' }
const customerActor: EditorialActor = { kind: 'user', id: 2, role: 'customer' }
const studio: EditorialActor = { kind: 'machine', name: 'studio' }
const secret = 'studio-machine-secret-for-tests-0123456789'

// Video 10 becomes a live show, 11 stays recorded. Types are set before any review
// state exists, because the review freeze then refuses every write to videos.
async function editorialHarness(t: TestContext) {
  const h = await harness(t)
  h.sqlite.exec("UPDATE videos SET type='live' WHERE id=10; UPDATE videos SET type='recorded' WHERE id=11")
  const times = new EditorialTimes(h.store, () => clock)
  const id = () => crypto.randomUUID()
  const status = async (promise: Promise<unknown>) => { try { await promise; return 200 } catch (error) { assert.ok(error instanceof ReviewError, String(error)); return error.status } }
  const row = (videoId = 10) => h.sqlite.prepare('SELECT * FROM video_editorial_times WHERE id=?').get(videoId) as Record<string, unknown> | undefined
  const count = (sql: string) => Number(h.sqlite.prepare(sql).get()?.n)
  return { ...h, times, id, status, row, count }
}

test('staff schedule with a version fence; broadcast times only ever move forward', async t => {
  const h = await editorialHarness(t)
  const scheduled = await h.times.execute(staffActor, { action: 'schedule', videoId: 10, commandId: h.id(), expectedVersion: 0, scheduledStartAt: '2026-10-10T18:00:00+01:00' })
  assert.equal(scheduled.version, 1)
  assert.equal(scheduled.times.scheduledStartAt, '2026-10-10T17:00:00.000Z', 'stored as canonical UTC')
  assert.equal(h.row()?.source, 'editorial')
  assert.equal(await h.status(h.times.execute(staffActor, { action: 'schedule', videoId: 10, commandId: h.id(), expectedVersion: 0, scheduledStartAt: iso(60 * minute) })), 409, 'stale version')
  const read = await h.times.read(10)
  assert.equal(read.version, 1)
  assert.deepEqual(read.history.map(event => [event.field, event.actor, event.next]), [['scheduledStartAt', 'user:1', '2026-10-10T17:00:00.000Z']])

  const started = await h.times.execute(studio, { action: 'broadcast-started', legacyId: 'stable-video', commandId: h.id(), at: iso(-5 * minute) })
  assert.equal(started.times.broadcastStartedAt, iso(-5 * minute))
  assert.equal(h.row()?.source, 'studio')
  // An equal start is idempotent even under a new command id; a different one conflicts.
  assert.equal((await h.times.execute(studio, { action: 'broadcast-started', videoId: 10, commandId: h.id(), at: iso(-5 * minute) })).version, started.version)
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-started', legacyId: 'stable-video', commandId: h.id(), at: iso(-4 * minute) })), 409)
  assert.equal(await h.status(h.times.execute(staffActor, { action: 'schedule', videoId: 10, commandId: h.id(), expectedVersion: started.version, scheduledStartAt: null })), 409, 'schedule after start')
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-ended', legacyId: 'stable-video', commandId: h.id(), at: iso(-6 * minute) })), 400, 'ends before it started')
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-ended', legacyId: 'stable-video', commandId: h.id(), at: iso(5 * minute) })), 400, 'ends in the future')
  const ended = await h.times.execute(studio, { action: 'broadcast-ended', legacyId: 'stable-video', commandId: h.id(), at: iso(0) })
  assert.equal(ended.times.broadcastEndedAt, iso(0))
  assert.equal((await h.times.execute(studio, { action: 'broadcast-ended', legacyId: 'stable-video', commandId: h.id(), at: iso(0) })).version, ended.version, 'equal end is idempotent')
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-ended', legacyId: 'stable-video', commandId: h.id(), at: iso(-1 * minute) })), 409, 'staff correct a different end')
  assert.equal(h.count('SELECT count(*) AS n FROM editorial_time_events WHERE video_id=10'), 3)
})

test('a stream restarted on the same Studio session reads live again and keeps its first start', async t => {
  const h = await editorialHarness(t)
  await h.times.execute(studio, { action: 'broadcast-started', legacyId: 'stable-video', commandId: h.id(), at: iso(-30 * minute) })
  await h.times.execute(studio, { action: 'broadcast-ended', legacyId: 'stable-video', commandId: h.id(), at: iso(-20 * minute) })
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-started', legacyId: 'stable-video', commandId: h.id(), at: iso(-25 * minute) })), 409, 'a start inside the ended segment')
  const restarted = await h.times.execute(studio, { action: 'broadcast-started', legacyId: 'stable-video', commandId: h.id(), at: iso(-10 * minute) })
  assert.deepEqual([restarted.changed, restarted.times.broadcastStartedAt, restarted.times.broadcastEndedAt], [['broadcastEndedAt'], iso(-30 * minute), null])
  const ended = await h.times.execute(studio, { action: 'broadcast-ended', legacyId: 'stable-video', commandId: h.id(), at: iso(0) })
  assert.deepEqual([ended.times.broadcastStartedAt, ended.times.broadcastEndedAt], [iso(-30 * minute), iso(0)])
  assert.equal(h.count("SELECT count(*) AS n FROM editorial_time_events WHERE note='Broadcast restarted'"), 1)
})

test('a machine command retries a version race instead of losing the broadcast', async t => {
  const h = await editorialHarness(t)
  const raced = h.times as unknown as { row: (videoId: number) => Promise<unknown> }
  const row = raced.row.bind(h.times)
  let races = 1
  raced.row = async (videoId: number) => {
    const current = await row(videoId)
    if (races-- > 0) h.sqlite.exec(`INSERT INTO video_editorial_times(id,scheduled_start_at,source) VALUES(10,'${iso(-60 * minute)}','editorial')`)
    return current
  }
  const started = await h.times.execute(studio, { action: 'broadcast-started', legacyId: 'stable-video', commandId: h.id(), at: iso(0) })
  assert.deepEqual([started.version, started.times.scheduledStartAt, started.times.broadcastStartedAt], [2, iso(-60 * minute), iso(0)])
  // A race that never settles is retryable for the machine and a reload for staff.
  raced.row = async (videoId: number) => {
    const current = await row(videoId)
    h.sqlite.exec('UPDATE video_editorial_times SET version=version+1 WHERE id=10')
    return current
  }
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-ended', legacyId: 'stable-video', commandId: h.id(), at: iso(0) })), 503)
  const version = Number(h.row()?.version)
  assert.equal(await h.status(h.times.execute(staffActor, { action: 'correct', videoId: 10, commandId: h.id(), expectedVersion: version, note: 'fix', fields: { scheduledStartAt: iso(0) } })), 409)
})

test('broadcast commands accept ad hoc live starts, refuse recorded videos and stale clocks', async t => {
  const h = await editorialHarness(t)
  // No schedule: a live show may start ad hoc, and the start is still recorded.
  assert.equal((await h.times.execute(studio, { action: 'broadcast-started', legacyId: 'stable-video', commandId: h.id(), at: iso(0) })).times.broadcastStartedAt, iso(0))
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-started', legacyId: 'other-video', commandId: h.id(), at: iso(0) })), 409, 'recorded video')
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-started', legacyId: 'missing-video', commandId: h.id(), at: iso(0) })), 404)
  h.sqlite.exec("INSERT INTO videos(id,legacy_id,legacy_type,slug,title,_status,type) VALUES(12,'old-live','Video','old-live','Old live','draft','live')")
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-started', legacyId: 'old-live', commandId: h.id(), at: iso(-25 * 3600 * 1000) })), 400, 'older than a day')
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-started', legacyId: 'old-live', commandId: h.id(), at: iso(3 * minute) })), 400, 'beyond the clock skew allowance')
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-ended', legacyId: 'old-live', commandId: h.id(), at: iso(0) })), 409, 'not started')
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-started', legacyId: 'old-live', videoId: 12, commandId: h.id(), at: iso(0) })), 400, 'exactly one target')
  h.sqlite.exec('UPDATE videos SET tombstone=1 WHERE id=12')
  assert.equal(await h.status(h.times.execute(studio, { action: 'broadcast-started', legacyId: 'old-live', commandId: h.id(), at: iso(0) })), 404, 'tombstoned')
})

test('only staff schedule and correct; corrections need a note and keep the ordering', async t => {
  const h = await editorialHarness(t)
  assert.equal(await h.status(h.times.execute(customerActor, { action: 'schedule', videoId: 10, commandId: h.id(), expectedVersion: 0, scheduledStartAt: iso(0) })), 403)
  assert.equal(await h.status(h.times.execute(customerActor, { action: 'broadcast-started', videoId: 10, commandId: h.id(), at: iso(0) })), 403)
  assert.equal(await h.status(h.times.execute(studio, { action: 'schedule', videoId: 10, commandId: h.id(), expectedVersion: 0, scheduledStartAt: iso(0) })), 403, 'the machine never schedules')
  assert.equal(await h.status(h.times.execute(staffActor, { action: 'correct', videoId: 10, commandId: h.id(), expectedVersion: 0, fields: { broadcastStartedAt: iso(0) } })), 400, 'note required')
  assert.equal(await h.status(h.times.execute(staffActor, { action: 'correct', videoId: 10, commandId: h.id(), expectedVersion: 0, fields: {}, note: 'x' })), 400, 'at least one field')
  assert.equal(await h.status(h.times.execute(staffActor, { action: 'correct', videoId: 10, commandId: h.id(), expectedVersion: 0, fields: { broadcastEndedAt: iso(0) }, note: 'missed end' })), 400, 'end without a start')
  assert.equal(await h.status(h.times.execute(staffActor, { action: 'correct', videoId: 10, commandId: h.id(), expectedVersion: 0, fields: { publishedAt: iso(0) }, note: 'x' } as never)), 400, 'publish time is owned by review publish')
  const corrected = await h.times.execute(staffActor, { action: 'correct', videoId: 10, commandId: h.id(), expectedVersion: 0, fields: { broadcastStartedAt: iso(-60 * minute), broadcastEndedAt: iso(-10 * minute) }, note: 'Studio was offline' })
  assert.deepEqual(corrected.changed, ['broadcastStartedAt', 'broadcastEndedAt'])
  assert.deepEqual(h.sqlite.prepare("SELECT note FROM editorial_time_events WHERE action='correct'").all().map(row => row.note), ['Studio was offline', 'Studio was offline'])
  // The CHECK constraint is the last line of defence.
  assert.throws(() => h.sqlite.exec(`UPDATE video_editorial_times SET broadcast_ended_at='${iso(-2 * 60 * minute)}' WHERE id=10`), /CHECK constraint failed/)
})

test('command ids replay the journaled result and refuse reuse with other input', async t => {
  const h = await editorialHarness(t)
  const commandId = h.id()
  const input = { action: 'schedule', videoId: 10, commandId, expectedVersion: 0, scheduledStartAt: iso(60 * minute) }
  const first = await h.times.execute(staffActor, input)
  // After the replay the version moved on, yet the stored result comes back.
  assert.deepEqual(await h.times.execute(staffActor, input), first)
  assert.equal(await h.status(h.times.execute(staffActor, { ...input, scheduledStartAt: iso(90 * minute) })), 409)
  assert.equal(await h.status(h.times.execute({ kind: 'user', id: 4, role: 'staff' }, input)), 409, 'another actor')
  assert.equal(h.count('SELECT count(*) AS n FROM editorial_commands'), 1)
  assert.equal(h.count('SELECT count(*) AS n FROM review_command_guards'), 0, 'no guard rows are left behind')
})

test('editorial history is immutable and reviewed videos still accept times', async t => {
  const h = await editorialHarness(t)
  await h.prepare()
  assert.throws(() => h.sqlite.exec("UPDATE videos SET title='x' WHERE id=10"), /Managed video/)
  await h.times.execute(staffActor, { action: 'schedule', videoId: 10, commandId: h.id(), expectedVersion: 0, scheduledStartAt: iso(60 * minute) })
  assert.throws(() => h.sqlite.exec("UPDATE editorial_time_events SET note='x'"), /Editorial time history is immutable/)
  assert.throws(() => h.sqlite.exec('DELETE FROM editorial_time_events'), /Editorial time history is immutable/)
})

test('effective times read imported git values until the side table has its own', async t => {
  const h = await editorialHarness(t)
  h.sqlite.exec("INSERT INTO videos(id,legacy_id,legacy_type,slug,title,_status,type,published_at) VALUES(12,'imported-live','Video','imported-live','Imported live','published','live','2020-01-02T00:00:00.000Z')")
  let read = await h.times.read(12)
  assert.equal(read.stored, null)
  assert.equal(read.effective.scheduledStartAt, '2020-01-02T00:00:00.000Z')
  assert.equal(read.effective.publishedAt, '2020-01-02T00:00:00.000Z')
  // The importer rewrites publishedAt; the effective value follows.
  h.sqlite.exec("UPDATE videos SET published_at='2021-03-04T05:06:07.000Z' WHERE id=12")
  read = await h.times.read(12)
  assert.equal(read.effective.publishedAt, '2021-03-04T05:06:07.000Z')
  assert.deepEqual(effectiveTimes(null, { type: 'recorded', _status: 'draft', publishedAt: '2020-01-02T00:00:00.000Z' }), { scheduledStartAt: null, broadcastStartedAt: null, broadcastEndedAt: null, publishedAt: null })
  assert.equal(effectiveTimes({ published_at: '2026-01-01T00:00:00.000Z' }, { _status: 'published', publishedAt: '2020-01-01' }).publishedAt, '2026-01-01T00:00:00.000Z', 'the first release wins')
  assert.equal(effectiveTimes(null, { _status: 'published', publishedAt: 'not a date' }).publishedAt, null, 'malformed imports never break reads')
  assert.throws(() => canonicalTime('not a date'), { status: 400 })
})

async function machineRequest(body: Record<string, unknown>, options: { key?: string | null; cookie?: boolean; secret?: string } = {}) {
  const text = JSON.stringify(body)
  const key = options.key === undefined ? String(body.commandId) : options.key
  const headers = new Headers(await signMachineRequest(options.secret ?? secret, { method: 'POST', path: EDITORIAL_BROADCAST_PATH, principal: 'rawkode-studio', timestamp: Math.floor(Date.now() / 1000), idempotencyKey: key, body: text }))
  headers.set('content-type', 'application/json')
  if (options.cookie) headers.set('cookie', 'poc-oidc-session=x')
  return new Request(`https://admin.rawkode.academy${EDITORIAL_BROADCAST_PATH}`, { method: 'POST', headers, body: text })
}

test('the Studio machine route verifies the shared HMAC, binds the key to the command and accepts only broadcast actions', async t => {
  const h = await editorialHarness(t)
  const route = (configured: string | undefined) => createEditorialMachineHandlers({ secret: () => configured, runtime: async () => ({ times: h.times }) })
  const start = { action: 'broadcast-started', legacyId: 'stable-video', commandId: h.id(), at: iso(0) }
  assert.equal((await route(undefined).POST(await machineRequest(start))).status, 503, 'secret unset')
  assert.equal((await route('x'.repeat(31)).POST(await machineRequest(start))).status, 503, 'secret too short')
  const handlers = route(secret)
  assert.equal((await handlers.POST(await machineRequest(start, { secret: 'another-secret-another-secret-0123' }))).status, 401)
  assert.equal((await handlers.POST(await machineRequest(start, { cookie: true }))).status, 401, 'cookies are never machine requests')
  assert.equal((await handlers.POST(await machineRequest(start, { key: null }))).status, 400, 'unkeyed mutation')
  assert.equal((await handlers.POST(await machineRequest(start, { key: crypto.randomUUID() }))).status, 400, 'key must equal the commandId')
  const schedule = { action: 'schedule', videoId: 10, commandId: h.id(), expectedVersion: 0, scheduledStartAt: iso(0) }
  assert.equal((await handlers.POST(await machineRequest(schedule))).status, 400, 'schedule is staff only')
  const response = await handlers.POST(await machineRequest(start))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const result = await response.json() as { times: { broadcastStartedAt: string } }
  assert.equal(result.times.broadcastStartedAt, iso(0))
  // A replay of the signed request returns the journaled result.
  assert.deepEqual(await (await handlers.POST(await machineRequest(start))).json(), result)
  assert.equal(h.sqlite.prepare("SELECT actor FROM editorial_commands").get()?.actor, 'machine:studio')
})

test('the staff session route checks origin and role and refuses broadcast actions', async t => {
  const h = await editorialHarness(t)
  const origin = 'https://admin.rawkode.academy'
  const handlers = (actor = staff) => createEditorialHandlers(async () => ({ times: h.times, actor, origin }))
  const post = (body: unknown, from = origin) => new Request(`${origin}/api/editorial/times`, { method: 'POST', headers: { origin: from, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const schedule = { action: 'schedule', videoId: 10, commandId: h.id(), expectedVersion: 0, scheduledStartAt: iso(0) }
  assert.equal((await handlers().POST(post(schedule, 'https://preview.rawkode.academy'))).status, 403)
  assert.equal((await handlers(client).POST(post(schedule))).status, 403)
  assert.equal((await handlers().POST(post({ action: 'broadcast-started', videoId: 10, commandId: h.id(), at: iso(0) }))).status, 400)
  assert.equal((await handlers().POST(new Request(`${origin}/api/editorial/times`, { method: 'POST', headers: { origin }, body: '{}' }))).status, 415)
  assert.equal((await handlers().POST(post(schedule))).status, 200)
  const read = await handlers().GET(new Request(`${origin}/api/editorial/times?videoId=10`))
  assert.equal(read.status, 200)
  assert.equal(read.headers.get('cache-control'), 'private, no-store')
  assert.equal((await read.json() as { version: number }).version, 1)
  assert.equal((await handlers(client).GET(new Request(`${origin}/api/editorial/times?videoId=10`))).status, 403)
  assert.equal((await handlers().GET(new Request(`${origin}/api/editorial/times?videoId=x`))).status, 400)
})

test('the migration backfills only review-only first releases and rolls back cleanly until real data exists', async t => {
  const h = await harness(t)
  const args = h.migrationArgs
  await editorialMigration.down(args)
  h.sqlite.exec(`INSERT INTO videos(id,legacy_id,legacy_type,slug,title,_status,published_at) VALUES
      (12,'imported','Video','imported','Imported','published','2020-01-02T00:00:00.000Z'),
      (13,'reviewed-import','Video','reviewed-import','Reviewed import','published','2020-01-02T00:00:00.000Z');
    INSERT INTO video_review_state(video_id,generation) VALUES(11,1),(13,1);
    INSERT INTO video_revisions(id,video_id,media_id,checksum,deliverable_media_id,deliverable_checksum,duration_ms,review_version,state,metadata,created_by_id,created_at) VALUES
      ('r11',11,20,'a',21,'b',1000,1,'published','{}',1,'2026-10-01T00:00:00.000Z'),('r13',13,20,'a',21,'b',1000,1,'published','{}',1,'2026-10-01T00:00:00.000Z');
    INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at) VALUES
      ('d11',11,'r11',2,1,1,'approved','','2026-10-01T00:00:00.000Z'),('d13',13,'r13',2,1,1,'approved','','2026-10-01T00:00:00.000Z');
    INSERT INTO review_publication_events(id,video_id,revision_id,decision_id,published_by_id,published_at,object_key,object_etag,checksum,bytes,content_type) VALUES
      ('p1',11,'r11','d11',1,'2026-10-02T00:00:00.000Z','k1','e','c',1,'video/mp4'),('p2',11,'r11','d11',1,'2026-10-05T00:00:00.000Z','k2','e','c',1,'video/mp4'),
      ('p3',13,'r13','d13',1,'2026-10-06T00:00:00.000Z','k3','e','c',1,'video/mp4');
    INSERT INTO video_publications(id,document) VALUES(11,'{"id":11,"publishedAt":"2026-10-05T00:00:00.000Z"}'),(13,'{"id":13,"publishedAt":"2026-10-06T00:00:00.000Z"}');`)
  const projection = (id: number) => JSON.parse(String(h.sqlite.prepare('SELECT document FROM video_publications WHERE id=?').get(id)?.document)).publishedAt
  const rows = () => h.sqlite.prepare('SELECT id,published_at,source FROM video_editorial_times ORDER BY id').all().map(row => ({ ...row }))
  const schema = () => h.sqlite.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
  await editorialMigration.up(args)
  assert.deepEqual(rows(), [{ id: 11, published_at: '2026-10-02T00:00:00.000Z', source: 'backfill' }], 'imports get no row; review-only first release = MIN(events)')
  assert.equal(projection(11), '2026-10-02T00:00:00.000Z')
  assert.equal(projection(13), '2020-01-02T00:00:00.000Z', 'a published import keeps its git date')
  const migrated = schema()
  await editorialMigration.down(args)
  assert.equal(projection(11), '2026-10-05T00:00:00.000Z', 'down restores the latest release')
  assert.equal(projection(13), '2026-10-06T00:00:00.000Z')
  assert.equal(h.sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='video_editorial_times'").get()?.n, 0)
  await editorialMigration.up(args)
  assert.deepEqual(schema(), migrated)
  await editorialMigration.down(args)
  await editorialMigration.up(args)
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM review_command_guards').get()?.n, 0)
  // Real editorial data makes the rollback refuse and keeps every row.
  h.sqlite.exec("UPDATE videos SET type='live' WHERE id=12")
  await new EditorialTimes(h.store, () => clock).execute(staffActor, { action: 'schedule', videoId: 12, commandId: crypto.randomUUID(), expectedVersion: 0, scheduledStartAt: iso(0) })
  await assert.rejects(editorialMigration.down(args), /CHECK constraint failed/)
  assert.equal(rows().length, 2)
  assert.deepEqual(h.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

test('managed videos refuse hard deletes before a deletion marker is written', async t => {
  const h = await editorialHarness(t)
  const guard = videoDeleteGuard(h.db)
  const refused = async (id: number) => { try { await guard({ id }); return false } catch (error) { assert.equal((error as { status?: number }).status, 409); return true } }
  assert.equal(await refused(11), false, 'a plain video can be deleted')
  await h.times.execute(staffActor, { action: 'schedule', videoId: 10, commandId: h.id(), expectedVersion: 0, scheduledStartAt: iso(0) })
  assert.equal(await refused(10), true, 'a times row')
  await h.service.execute(staff, command('create-revision', { videoId: 11, mediaId: 20, deliverableMediaId: 21, durationMs: 60000, metadata: { title: 'Cut', description: 'Cut' } }))
  assert.equal(await refused(11), true, 'review state')
})
