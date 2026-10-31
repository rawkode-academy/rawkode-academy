import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { YouTube, findBroadcast, loadSession, planChanges, readState, runSession, timestamp, verifyBroadcast } from './youtube.mjs';

const channelId = 'UCabcdefghijklmnopqrstuv';
const now = Date.parse('2026-01-01T00:00:00Z');
const session = { sessionId: 'session-one', channelId, title: 'Example session', description: 'Approved copy', scheduledStartTime: '2027-06-17T16:00:00.000Z', privacyStatus: 'public', madeForKids: false };
const broadcast = (overrides = {}) => ({ id: 'abcdefghijk', snippet: { channelId, ...session, categoryId: '28', scheduledEndTime: '2027-06-17T17:15:00.000Z' }, status: { lifeCycleStatus: 'created', privacyStatus: 'public', selfDeclaredMadeForKids: false }, contentDetails: {}, ...overrides });

class FakeAPI {
  constructor(items = []) { this.items = structuredClone(items); this.writes = []; }
  async checkChannel(id) { assert.equal(id, channelId); }
  async checkStream(id, channel) { assert.equal(channel, channelId); this.checkedStream = id; }
  async broadcasts() { return structuredClone(this.items); }
  async broadcast(id, channel) {
    const item = this.items.find(x => x.id === id);
    assert.ok(item, 'Missing broadcast');
    assert.equal(item.snippet.channelId, channel);
    return structuredClone(item);
  }
  async request(method, resource, query, body) {
    this.writes.push({ method, resource, query, body });
    if (resource === 'liveBroadcasts' && method === 'POST') {
      const item = broadcast({ snippet: { ...body.snippet, channelId }, status: { ...body.status, lifeCycleStatus: 'created' }, contentDetails: body.contentDetails });
      this.items.push(item);
      if (this.loseCreateResponse) throw new Error('Lost response');
      return structuredClone(item);
    }
    if (resource === 'liveBroadcasts' && method === 'PUT') { this.items.find(x => x.id === body.id).snippet = { ...body.snippet, channelId }; return {}; }
    if (resource === 'thumbnails/set') { if (this.failThumbnail) throw new Error('Thumbnail failed'); return { items: [{ default: { url: 'https://example.test/thumbnail.jpg' } }] }; }
    if (resource === 'liveBroadcasts/bind') { this.items.find(x => x.id === query.id).contentDetails.boundStreamId = query.streamId; return {}; }
    throw new Error('Unexpected request');
  }
}

async function temporary(t) {
  const dir = await mkdtemp(join(tmpdir(), 'youtube-scheduler-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, statePath: join(dir, 'session.state.json') };
}

test('explicit summer offset becomes the correct UTC instant', () => {
  assert.equal(timestamp('2027-06-17T17:00:00+01:00', 'start'), '2027-06-17T16:00:00.000Z');
  assert.throws(() => timestamp('2027-06-17T17:00:00', 'start'), /explicit UTC offset/);
  assert.throws(() => timestamp('2027-02-30T17:00:00Z', 'start'), /calendar date/);
  assert.throws(() => timestamp('2027-06-17T24:00:00Z', 'start'), /clock time/);
});

test('manifest rejects misspelled fields before contacting YouTube', async t => {
  const { dir } = await temporary(t);
  const path = join(dir, 'session.json');
  await writeFile(path, JSON.stringify({ ...session, publishAt: session.scheduledStartTime }));
  await assert.rejects(loadSession(path), /Unknown session field: publishAt/);
});

test('description file resolves relative to the session and preserves exact text', async t => {
  const { dir } = await temporary(t);
  await writeFile(join(dir, 'description.txt'), 'Guest: Ellie\n\nAtuin\n');
  await writeFile(join(dir, 'session.json'), JSON.stringify({ sessionId: 'atuin', channelId, broadcastId: 'abcdefghijk', descriptionFile: 'description.txt' }));
  const loaded = await loadSession(join(dir, 'session.json'));
  assert.equal(loaded.description, 'Guest: Ellie\n\nAtuin\n');
});

test('description update preserves start, end, category and unrelated API parts', () => {
  const changes = planChanges({ sessionId: session.sessionId, channelId, description: 'Revised' }, broadcast(), {}, null, now);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].body.snippet.scheduledEndTime, '2027-06-17T17:15:00.000Z');
  assert.equal(changes[0].body.snippet.categoryId, '28');
  assert.equal(changes[0].body.snippet.scheduledStartTime, session.scheduledStartTime);
  assert.equal(changes[0].body.status, undefined);
  assert.equal(changes[0].body.contentDetails, undefined);
});

test('reschedule cannot put start after the preserved end', () => {
  assert.throws(() => planChanges({ ...session, scheduledStartTime: '2027-06-17T18:00:00Z' }, broadcast(), {}, null, now), /End must follow/);
});

test('creation requires explicit audience, visibility and a future start', () => {
  assert.throws(() => planChanges({ ...session, scheduledStartTime: '2025-01-01T00:00:00Z' }, null, {}, null, now), /future/);
  const { madeForKids, ...missingAudience } = session;
  assert.throws(() => planChanges(missingAudience, null, {}, null, now), /madeForKids/);
});

test('active broadcasts and unexpected visibility changes are rejected', () => {
  assert.throws(() => planChanges(session, broadcast({ status: { lifeCycleStatus: 'live' } }), {}, null, now), /Only upcoming/);
  assert.throws(() => planChanges({ ...session, privacyStatus: 'private' }, broadcast(), {}, null, now), /visibility differs/);
});

test('plan performs no remote writes or state writes', async t => {
  const { statePath } = await temporary(t);
  const api = new FakeAPI();
  const result = await runSession({ api, session, statePath, now });
  assert.equal(result.actions[0].kind, 'create');
  assert.deepEqual(api.writes, []);
  assert.deepEqual(await readState(statePath), {});
});

test('wrong OAuth channel prevents every write', async t => {
  const { statePath } = await temporary(t);
  const api = new FakeAPI();
  api.checkChannel = async () => { throw new Error('Wrong channel'); };
  await assert.rejects(runSession({ api, session, statePath, apply: true, now }), /Wrong channel/);
  assert.deepEqual(api.writes, []);
});

test('existing ID is updated, never recreated', async t => {
  const { statePath } = await temporary(t);
  const api = new FakeAPI([broadcast()]);
  const result = await runSession({ api, session: { ...session, broadcastId: 'abcdefghijk', description: 'Updated' }, statePath, apply: true, now });
  assert.deepEqual(result.changed, ['update']);
  assert.equal(api.writes[0].query.part, 'snippet');
  assert.equal(api.items.length, 1);
});

test('a missing known ID is a failure, not permission to create', async () => {
  const api = new FakeAPI();
  await assert.rejects(findBroadcast(api, { ...session, broadcastId: 'abcdefghijk' }, {}), /Missing/);
  assert.deepEqual(api.writes, []);
});

test('duplicate discovery and state identity conflicts stop before writes', async () => {
  const api = new FakeAPI([broadcast(), broadcast({ id: 'lmnopqrstuv' })]);
  await assert.rejects(findBroadcast(api, session, {}), /Multiple matching/);
  await assert.rejects(findBroadcast(api, session, { sessionId: 'another', channelId }), /another session/);
  await assert.rejects(findBroadcast(api, { ...session, broadcastId: 'lmnopqrstuv' }, { sessionId: session.sessionId, channelId, broadcastId: 'abcdefghijk' }), /different broadcast IDs/);
});

test('lost creation response is recovered by listing without another insert', async t => {
  const { statePath } = await temporary(t);
  const api = new FakeAPI();
  api.loseCreateResponse = true;
  await assert.rejects(runSession({ api, session, statePath, apply: true, now }), /Lost response/);
  assert.ok((await readState(statePath)).pendingCreate);
  const result = await runSession({ api, session, statePath, apply: true, now });
  assert.equal(result.broadcastId, 'abcdefghijk');
  assert.equal(api.writes.filter(x => x.method === 'POST' && x.resource === 'liveBroadcasts').length, 1);
  assert.equal((await readState(statePath)).pendingCreate, undefined);
});

test('unknown creation outcome with no visible match cannot create again', async t => {
  const { statePath } = await temporary(t);
  await writeFile(statePath, JSON.stringify({ sessionId: session.sessionId, channelId, pendingCreate: { title: session.title, scheduledStartTime: session.scheduledStartTime } }));
  const api = new FakeAPI();
  await assert.rejects(runSession({ api, session, statePath, apply: true, now }), /outcome is unknown/);
  assert.deepEqual(api.writes, []);
});

test('thumbnail failure after creation retains ID and a retry resumes', async t => {
  const { dir, statePath } = await temporary(t);
  const thumbnailFile = join(dir, 'thumbnail.jpg');
  await writeFile(thumbnailFile, Buffer.from([255, 216, 255, 224, 0, 0]));
  const api = new FakeAPI();
  api.failThumbnail = true;
  await assert.rejects(runSession({ api, session: { ...session, thumbnailFile }, statePath, apply: true, now }), /Thumbnail failed/);
  assert.equal((await readState(statePath)).broadcastId, 'abcdefghijk');
  api.failThumbnail = false;
  await runSession({ api, session: { ...session, thumbnailFile }, statePath, apply: true, now });
  assert.equal(api.items.length, 1);
  const result = await runSession({ api, session: { ...session, thumbnailFile }, statePath, now });
  assert.deepEqual(result.actions, []);
});

test('explicit encoder binding is checked and never transitions a broadcast', async t => {
  const { statePath } = await temporary(t);
  const api = new FakeAPI([broadcast()]);
  const result = await runSession({ api, session: { ...session, streamId: 'existing-stream' }, statePath, apply: true, now });
  assert.equal(api.checkedStream, 'existing-stream');
  assert.equal(result.encoderBound, true);
  assert.deepEqual(api.writes.map(x => x.resource), ['liveBroadcasts/bind']);
});

test('a state lock prevents concurrent apply', async t => {
  const { statePath } = await temporary(t);
  await writeFile(`${statePath}.lock`, '');
  const api = new FakeAPI();
  await assert.rejects(runSession({ api, session, statePath, apply: true, now }), /locked/);
  assert.deepEqual(api.writes, []);
});

test('read-back detects a write that was not applied', () => {
  assert.throws(() => verifyBroadcast({ ...session, description: 'Not applied' }, broadcast()), /Read-back mismatch: description/);
});

test('broadcast listing paginates and uses one documented filter', async () => {
  const calls = [];
  const api = new YouTube({}, async url => {
    calls.push(new URL(url));
    return new Response(JSON.stringify(calls.length === 1 ? { items: [], nextPageToken: 'next' } : { items: [broadcast()] }), { status: 200 });
  });
  assert.equal((await api.broadcasts(channelId)).length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get('mine'), 'true');
  assert.equal(calls[0].searchParams.has('broadcastStatus'), false);
  assert.equal(calls[1].searchParams.get('pageToken'), 'next');
});

test('API errors do not expose server payloads or automatically retry', async () => {
  let calls = 0;
  const api = new YouTube({}, async () => { calls++; return new Response(JSON.stringify({ error: { message: 'sensitive-server-payload' } }), { status: 403 }); });
  await assert.rejects(api.request('POST', 'liveBroadcasts', {}, {}), error => !error.message.includes('sensitive-server-payload') && /HTTP 403/.test(error.message));
  assert.equal(calls, 1);
});

test('malformed proxy responses never leak response body text', async () => {
  const api = new YouTube({}, async () => new Response('sensitive-proxy-response', { status: 502 }));
  await assert.rejects(api.request('GET', 'channels'), error => !error.message.includes('sensitive-proxy-response') && /invalid response/.test(error.message));
});
