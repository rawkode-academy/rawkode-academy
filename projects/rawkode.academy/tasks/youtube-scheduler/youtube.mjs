#!/usr/bin/env node
// Node 22+; no runtime dependencies. Never prints OAuth tokens or stream keys.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const API = 'https://www.googleapis.com/youtube/v3/';
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/';
const SNIPPET_FIELDS = ['title', 'description', 'categoryId', 'scheduledStartTime', 'scheduledEndTime'];
const SESSION_FIELDS = new Set(['sessionId', 'channelId', 'broadcastId', 'title', 'description', 'descriptionFile', 'scheduledStartTime', 'scheduledEndTime', 'privacyStatus', 'madeForKids', 'thumbnailFile', 'streamId']);
const has = (o, k) => Object.hasOwn(o, k);
const pick = (o, keys) => Object.fromEntries(keys.filter(k => has(o, k)).map(k => [k, o[k]]));
const sameTime = (a, b) => Date.parse(a) === Date.parse(b);

function requireThat(ok, message) {
  if (!ok) throw new Error(message);
}

export function timestamp(value, name) {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), `${name} must be an ISO timestamp with an explicit UTC offset`);
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  requireThat(month >= 1 && month <= 12 && day >= 1 && day <= days, `${name} contains an invalid calendar date`);
  requireThat(Number(value.slice(11, 13)) <= 23 && Number(value.slice(14, 16)) <= 59 && Number(value.slice(17, 19)) <= 59, `${name} contains an invalid clock time`);
  return new Date(value).toISOString();
}

export async function loadSession(path) {
  const raw = JSON.parse(await readFile(path, 'utf8'));
  requireThat(raw && typeof raw === 'object' && !Array.isArray(raw), 'Session must be a JSON object');
  for (const key of Object.keys(raw)) requireThat(SESSION_FIELDS.has(key), `Unknown session field: ${key}`);
  const s = { ...raw };
  requireThat(typeof s.sessionId === 'string' && /^[a-zA-Z0-9_-]+$/.test(s.sessionId), 'sessionId must be a stable slug or Academy video ID');
  requireThat(/^UC[a-zA-Z0-9_-]{22}$/.test(s.channelId ?? ''), 'A canonical channelId is required');
  if (has(s, 'broadcastId')) requireThat(/^[a-zA-Z0-9_-]{11}$/.test(s.broadcastId), 'Invalid broadcastId');
  if (has(s, 'streamId')) requireThat(typeof s.streamId === 'string' && /^[a-zA-Z0-9_-]+$/.test(s.streamId), 'Invalid streamId');
  if (has(s, 'title')) requireThat(typeof s.title === 'string' && s.title.trim().length > 0 && [...s.title].length <= 100 && !/[<>]/.test(s.title), 'title must contain 1–100 characters without angle brackets');
  requireThat(!(has(s, 'description') && has(s, 'descriptionFile')), 'Use description or descriptionFile, not both');
  if (has(s, 'descriptionFile')) {
    s.description = await readFile(resolve(dirname(path), s.descriptionFile), 'utf8');
    delete s.descriptionFile;
  }
  if (has(s, 'description')) requireThat(typeof s.description === 'string' && Buffer.byteLength(s.description, 'utf8') <= 5000 && !/[<>]/.test(s.description), 'description must be at most 5,000 UTF-8 bytes without angle brackets');
  for (const key of ['scheduledStartTime', 'scheduledEndTime']) if (has(s, key)) s[key] = timestamp(s[key], key);
  if (s.scheduledStartTime && s.scheduledEndTime) requireThat(Date.parse(s.scheduledEndTime) > Date.parse(s.scheduledStartTime), 'End must follow start');
  if (has(s, 'privacyStatus')) requireThat(['public', 'unlisted', 'private'].includes(s.privacyStatus), 'Invalid privacyStatus');
  if (has(s, 'madeForKids')) requireThat(typeof s.madeForKids === 'boolean', 'madeForKids must be an explicit boolean');
  if (has(s, 'thumbnailFile')) s.thumbnailFile = resolve(dirname(path), s.thumbnailFile);
  return s;
}

export async function loadThumbnail(path) {
  if (!path) return null;
  const bytes = await readFile(path);
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  requireThat((png || jpeg) && bytes.length <= 50 * 1024 * 1024, 'Thumbnail must be a JPEG or PNG no larger than 50 MiB');
  return { bytes, contentType: png ? 'image/png' : 'image/jpeg', sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function readState(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

export async function saveState(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  const file = await open(temp, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
  await rename(temp, path);
}

export class YouTube {
  constructor(credentials, fetchImpl = fetch) { this.credentials = credentials; this.fetch = fetchImpl; }

  async authorize() {
    const c = this.credentials;
    requireThat(c.client_id && c.client_secret && c.refresh_token, 'Missing OAuth credentials; run authorize.py first');
    const response = await this.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: c.client_id, client_secret: c.client_secret, refresh_token: c.refresh_token }),
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error(`OAuth refresh returned an invalid response (HTTP ${response.status})`); }
    requireThat(response.ok && data.access_token, `OAuth refresh failed (HTTP ${response.status}); reauthorize if access expired or was revoked`);
    this.accessToken = data.access_token;
  }

  async request(method, resource, query = {}, body, contentType) {
    const url = new URL(resource, contentType ? UPLOAD : API);
    for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
    const response = await this.fetch(url, {
      method, signal: AbortSignal.timeout(30000),
      headers: { authorization: `Bearer ${this.accessToken}`, ...(body !== undefined ? { 'content-type': contentType ?? 'application/json' } : {}) },
      ...(body !== undefined ? { body: contentType ? body : JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error(`YouTube ${method} ${resource} returned an invalid response (HTTP ${response.status})`); }
    // Do not include server messages, request bodies, or credentials in errors.
    requireThat(response.ok, `YouTube ${method} ${resource} failed (HTTP ${response.status})`);
    return data;
  }

  async checkChannel(channelId) {
    const data = await this.request('GET', 'channels', { part: 'id', mine: true });
    requireThat(data.items?.some(c => c.id === channelId), 'OAuth identity does not own the requested channel');
  }

  async broadcast(id, channelId) {
    const data = await this.request('GET', 'liveBroadcasts', { part: 'id,snippet,status,contentDetails', id });
    const item = data.items?.find(x => x.id === id);
    requireThat(item, `Broadcast ${id} was not found; refusing to create a replacement`);
    requireThat(item.snippet?.channelId === channelId, 'Broadcast belongs to another channel');
    return item;
  }

  async broadcasts(channelId) {
    const items = [];
    let pageToken;
    do {
      // mine and broadcastStatus are mutually exclusive filters.
      const data = await this.request('GET', 'liveBroadcasts', { part: 'id,snippet,status,contentDetails', mine: true, broadcastType: 'all', maxResults: 50, pageToken });
      items.push(...(data.items ?? []).filter(x => x.snippet?.channelId === channelId));
      pageToken = data.nextPageToken;
    } while (pageToken);
    return items;
  }

  async checkStream(id, channelId) {
    const data = await this.request('GET', 'liveStreams', { part: 'id,snippet,status', id, fields: 'items(id,snippet/channelId,status/streamStatus)' });
    const stream = data.items?.find(s => s.id === id && s.snippet?.channelId === channelId);
    requireThat(stream, 'Encoder stream was not found on the requested channel');
    requireThat(stream.status?.streamStatus !== 'active', 'Encoder stream is already active; refusing to bind it');
  }
}

export async function findBroadcast(api, session, state) {
  if (state.sessionId) requireThat(state.sessionId === session.sessionId && state.channelId === session.channelId, 'State belongs to another session or channel');
  if (state.broadcastId && session.broadcastId) requireThat(state.broadcastId === session.broadcastId, 'Manifest and state have different broadcast IDs');
  const id = session.broadcastId ?? state.broadcastId;
  if (id) return api.broadcast(id, session.channelId);
  const intended = state.pendingCreate ?? session;
  requireThat(intended.title && intended.scheduledStartTime, 'Creation or discovery requires title and scheduledStartTime');
  const matches = (await api.broadcasts(session.channelId)).filter(b => b.snippet.title === intended.title && sameTime(b.snippet.scheduledStartTime, intended.scheduledStartTime));
  requireThat(matches.length <= 1, 'Multiple matching broadcasts exist; supply the intended broadcastId');
  if (matches[0]) return matches[0];
  requireThat(!state.pendingCreate, 'Previous creation outcome is unknown. Inspect YouTube and supply broadcastId; never retry creation blindly');
  return null;
}

export function planChanges(session, current, state = {}, thumbnail = null, now = Date.now()) {
  const actions = [];
  if (!current) {
    for (const key of ['title', 'description', 'scheduledStartTime', 'privacyStatus', 'madeForKids']) requireThat(has(session, key), `Creation requires ${key}`);
    requireThat(Date.parse(session.scheduledStartTime) > now, 'Start must be in the future');
    actions.push({ kind: 'create', body: {
      snippet: pick(session, SNIPPET_FIELDS),
      status: { privacyStatus: session.privacyStatus, selfDeclaredMadeForKids: session.madeForKids },
      contentDetails: { enableAutoStart: false, enableAutoStop: false, enableDvr: true, recordFromStart: true },
    } });
  } else {
    requireThat(['created', 'ready'].includes(current.status?.lifeCycleStatus), 'Only upcoming broadcasts may be modified');
    // Visibility/audience changes are deliberately outside this scheduling CLI.
    if (has(session, 'privacyStatus')) requireThat(session.privacyStatus === current.status.privacyStatus, 'Existing visibility differs; use an explicitly reviewed visibility edit');
    if (has(session, 'madeForKids')) requireThat(session.madeForKids === current.status.selfDeclaredMadeForKids, 'Existing audience setting differs; review it in YouTube Studio');
    const snippet = { ...pick(current.snippet, SNIPPET_FIELDS), ...pick(session, SNIPPET_FIELDS) };
    const changed = SNIPPET_FIELDS.filter(k => has(session, k) && (k.endsWith('Time') ? !sameTime(snippet[k], current.snippet[k]) : snippet[k] !== current.snippet[k]));
    if (changed.length) {
      requireThat(snippet.title && snippet.scheduledStartTime, 'Existing broadcast is missing required snippet fields');
      requireThat(Date.parse(snippet.scheduledStartTime) > now, 'Start must be in the future');
      if (snippet.scheduledEndTime) requireThat(Date.parse(snippet.scheduledEndTime) > Date.parse(snippet.scheduledStartTime), 'End must follow the new start; specify scheduledEndTime');
      actions.push({ kind: 'update', fields: changed, body: { id: current.id, snippet } });
    }
  }
  if (thumbnail && (state.broadcastId !== current?.id || state.thumbnailSha256 !== thumbnail.sha256)) actions.push({ kind: 'thumbnail', sha256: thumbnail.sha256, bytes: thumbnail.bytes.length, file: session.thumbnailFile });
  if (session.streamId && current?.contentDetails?.boundStreamId !== session.streamId) actions.push({ kind: 'bind', streamId: session.streamId });
  return actions;
}

export function verifyBroadcast(session, broadcast) {
  requireThat(broadcast.snippet?.channelId === session.channelId, 'Read-back channel mismatch');
  for (const key of SNIPPET_FIELDS) if (has(session, key)) requireThat(key.endsWith('Time') ? sameTime(session[key], broadcast.snippet[key]) : session[key] === broadcast.snippet[key], `Read-back mismatch: ${key}`);
  if (has(session, 'privacyStatus')) requireThat(session.privacyStatus === broadcast.status?.privacyStatus, 'Read-back visibility mismatch');
  if (has(session, 'madeForKids')) requireThat(session.madeForKids === broadcast.status?.selfDeclaredMadeForKids, 'Read-back audience mismatch');
  if (session.streamId) requireThat(session.streamId === broadcast.contentDetails?.boundStreamId, 'Read-back stream binding mismatch');
  return { broadcastId: broadcast.id, channelId: session.channelId, title: broadcast.snippet.title, scheduledStartTime: broadcast.snippet.scheduledStartTime, privacyStatus: broadcast.status?.privacyStatus, lifeCycleStatus: broadcast.status?.lifeCycleStatus, encoderBound: Boolean(broadcast.contentDetails?.boundStreamId), url: `https://www.youtube.com/live/${broadcast.id}` };
}

export async function runSession({ api, session, statePath, apply = false, verify = false, now = Date.now() }) {
  let lock;
  if (apply) {
    await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
    try { lock = await open(`${statePath}.lock`, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('Session is locked by another apply; inspect a stale lock before removing it'); throw error; }
  }
  try {
    let state = await readState(statePath);
    const thumbnail = await loadThumbnail(session.thumbnailFile);
    await api.checkChannel(session.channelId);
    let current = await findBroadcast(api, session, state);
    if (verify) {
      requireThat(current, 'No existing broadcast to verify');
      return verifyBroadcast(session, current);
    }
    const actions = planChanges(session, current, state, thumbnail, now);
    if (actions.some(a => a.kind === 'bind')) await api.checkStream(session.streamId, session.channelId);
    if (!apply) return { mode: 'plan', channelId: session.channelId, sessionId: session.sessionId, broadcastId: current?.id ?? null, actions };
    state = { ...state, sessionId: session.sessionId, channelId: session.channelId };
    if (current) { state.broadcastId = current.id; delete state.pendingCreate; await saveState(statePath, state); }
    for (const action of actions) {
      if (action.kind === 'create') {
        state.pendingCreate = { title: session.title, scheduledStartTime: session.scheduledStartTime, attemptedAt: new Date(now).toISOString() };
        await saveState(statePath, state); // Journal BEFORE the non-idempotent POST.
        current = await api.request('POST', 'liveBroadcasts', { part: 'snippet,status,contentDetails' }, action.body);
        requireThat(/^[a-zA-Z0-9_-]{11}$/.test(current.id ?? ''), 'Creation returned no valid ID; inspect YouTube before retrying');
        state.broadcastId = current.id;
        delete state.pendingCreate;
        await saveState(statePath, state); // Save ID before any follow-up can fail.
        current = await api.broadcast(state.broadcastId, session.channelId);
      } else if (action.kind === 'update') {
        await api.request('PUT', 'liveBroadcasts', { part: 'snippet' }, action.body);
      } else if (action.kind === 'thumbnail') {
        const result = await api.request('POST', 'thumbnails/set', { videoId: state.broadcastId, uploadType: 'media' }, thumbnail.bytes, thumbnail.contentType);
        requireThat(result.items?.length > 0, 'Thumbnail upload did not return confirmation');
        state.thumbnailSha256 = thumbnail.sha256;
        await saveState(statePath, state);
      } else if (action.kind === 'bind') {
        await api.request('POST', 'liveBroadcasts/bind', { id: state.broadcastId, streamId: action.streamId, part: 'id,contentDetails' });
      }
    }
    const result = verifyBroadcast(session, await api.broadcast(state.broadcastId, session.channelId));
    state.verifiedAt = new Date().toISOString();
    await saveState(statePath, state);
    return { mode: 'applied', ...result, changed: actions.map(a => a.kind), thumbnail: thumbnail ? 'upload acknowledged; visually check YouTube' : 'unchanged' };
  } finally {
    if (lock) { await lock.close(); await unlink(`${statePath}.lock`); }
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { positionals, values } = parseArgs({ args: argv, allowPositionals: true, options: { credentials: { type: 'string' }, state: { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help || !positionals.length) {
    console.log('Usage: node youtube.mjs <validate|plan|apply|verify> session.json [--credentials path] [--state path]\nvalidate is offline. plan and verify are read-only. apply publishes the requested changes.');
    return;
  }
  const [command, input] = positionals;
  requireThat(['validate', 'plan', 'apply', 'verify'].includes(command) && input && positionals.length === 2, 'Expected command and one session JSON file; see --help');
  const session = await loadSession(resolve(input));
  if (command === 'validate') {
    const thumbnail = await loadThumbnail(session.thumbnailFile);
    console.log(JSON.stringify({ valid: true, session, ...(thumbnail ? { thumbnailSha256: thumbnail.sha256 } : {}) }, null, 2));
    return;
  }
  const credentialsPath = values.credentials ?? process.env.YOUTUBE_CREDENTIALS_FILE;
  requireThat(credentialsPath, 'Set YOUTUBE_CREDENTIALS_FILE or --credentials; run authorize.py once first');
  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  requireThat(!credentials.channel_id || credentials.channel_id === session.channelId, 'Credential file is for a different channel');
  const api = new YouTube(credentials);
  await api.authorize();
  const result = await runSession({ api, session, statePath: resolve(values.state ?? `${input}.state.json`), apply: command === 'apply', verify: command === 'verify' });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
