import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { intakeSchema } from '../src/migrations/20261005_180000_review_intake'

// Use Wrangler's already-installed runtime/bundler; no install or remote binding.
const require = createRequire(import.meta.url)
const wrangler = createRequire(require.resolve('wrangler/package.json'))
const { build } = wrangler('esbuild'), { Miniflare } = wrangler('miniflare')
const directory = await mkdtemp(join(tmpdir(), 'review-intake-worker-'))
const bundle = async (contents: string) => (await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' })).outputFiles[0].text
const gateway = await bundle(`import { reviewBridge } from '../website/review/bridge'; export default { fetch: reviewBridge }`)
const backend = await bundle(`
import { ReviewIntake } from './src/review/intake';
import { ReviewStore } from './src/review/store';
import { createIntakeHandlers } from './src/review/intake-http';
import { uploadSource } from './src/review/intake-storage';
import { reviewFailure } from './src/review/http';
export default { async fetch(request,env) {
  if (new URL(request.url).pathname === '/fixture-length') {
    const size=Number(new URL(request.url).searchParams.get('size'));
    const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(size));controller.close()}});
    try { await uploadSource(env.R2,'length-fixture/'+size,body,8,'af5570f5a1810b7af78caf4bc70a660f0df51e42baf91d4de5b2328de0e83dfc'); return new Response('unexpected'); }
    catch(error){ return reviewFailure(error); }
  }
  // Explicit local identity fixture; production OIDC is outside this check.
  const actor={id:1,collection:'users',role:'staff'};
  const review={dependencies:{video:async id=>({id,legacyId:'fixture'})}};
  const intake=new ReviewIntake(new ReviewStore(env.D1),env.R2,review);
  const handlers=createIntakeHandlers(async()=>({intake,actor,origin:'https://preview.rawkode.academy'}));
  return handlers[request.method](request);
}}`)
const manifest = (contents: string) => ({ mainModule: 'worker.js', modules: { 'worker.js': { type: 'esm', contents } } })
const runtime = new Miniflare({ workers: [
  { config: { name: 'gateway', manifest: manifest(gateway), compatibilityDate: '2026-10-01', env: { REVIEW_ORIGIN: { type: 'text', value: 'https://preview.rawkode.academy' }, REVIEW_BACKEND: { type: 'worker', worker: 'backend' } } } },
  { config: { name: 'backend', manifest: manifest(backend), compatibilityDate: '2026-10-01', env: { D1: { type: 'd1', id: 'intake-fixture' }, R2: { type: 'r2', name: 'intake-fixture' } } } },
], isolatedResourcePersistencePath: directory, telemetry: { enabled: false } })
try {
  const db = await runtime.getD1Database('D1', 'backend')
  for (const statement of ['CREATE TABLE users(id INTEGER PRIMARY KEY)', 'CREATE TABLE videos(id INTEGER PRIMARY KEY)', 'CREATE TABLE media(id INTEGER PRIMARY KEY)', 'CREATE TABLE review_command_guards(id TEXT PRIMARY KEY,valid INTEGER CHECK(valid=1))', ...intakeSchema, 'INSERT INTO users VALUES(1)', 'INSERT INTO videos VALUES(10)']) await db.prepare(statement).run()
  const origin = 'https://preview.rawkode.academy'
  const bytes = new Uint8Array(1024 * 1024 + 7).map((_, index) => index % 251)
  const checksum = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')
  const post = async (input: object) => runtime.dispatchFetch(`${origin}/api/review/uploads`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(input) })
  const beginInput = { action: 'begin', commandId: crypto.randomUUID(), videoId: 10, bytes: bytes.length, checksum, contentType: 'video/mp4', metadata: { title: 'Native binary fixture', description: 'Not actual playable media' } }
  const begin = await post(beginInput); assert.equal(begin.status, 200)
  const session = await begin.json() as { uploadUrl: string; sessionId: string }
  assert.deepEqual(await (await post(beginInput)).json(), session)
  const put = (body: Uint8Array, url = session.uploadUrl, extra = {}) => runtime.dispatchFetch(origin + url, { method: 'PUT', headers: { origin, 'content-type': 'video/mp4', 'content-length': String(bytes.length), ...extra }, body })
  const uploaded = await put(bytes); assert.equal(uploaded.status, 200, await uploaded.text())
  const retry = await put(bytes); assert.equal(retry.status, 200, await retry.text())
  assert.equal((await put(bytes, session.uploadUrl, { origin: 'https://evil.example' })).status, 403)
  const r2 = await runtime.getR2Bucket('R2', 'backend')
  const list = await r2.list(); assert.equal(list.objects.length, 1)
  const stored = await r2.head(list.objects[0].key)
  assert.equal(stored.size, bytes.length)
  assert.equal(Buffer.from(stored.checksums.sha256).toString('hex'), checksum)
  // A real HTTP transport rejects inconsistent lengths before the Worker.
  // Use truthful short/long Content-Length to verify the session boundary, then
  // inject short/long streams inside workerd to exercise native FixedLengthStream.
  for (const body of [bytes.slice(1), new Uint8Array(bytes.length + 1), new Uint8Array(bytes.length)]) {
    const next = await (await post({ ...beginInput, commandId: crypto.randomUUID() })).json() as { uploadUrl: string }
    const result = await put(body, next.uploadUrl, { 'content-length': String(body.length) })
    assert.equal(result.status, 400, await result.text())
  }
  const nativeBackend = await runtime.getWorker('backend')
  for (const size of [7, 9]) {
    const result = await nativeBackend.fetch(origin + '/fixture-length?size=' + size)
    assert.equal(result.status, 400, await result.text())
  }
  assert.equal((await r2.list()).objects.length, 1)
  const unavailable = await post({ action: 'process', sessionId: session.sessionId })
  assert.equal(unavailable.status, 503)
  console.log('PASS: local workerd service binding, native FixedLengthStream/R2 SHA-256, binary PUT, retry, origin and size/checksum rejection; no live OIDC, Astro/OpenNext server or media provider.')
} finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }) }
