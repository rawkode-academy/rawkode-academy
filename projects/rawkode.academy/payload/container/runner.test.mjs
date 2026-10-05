import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { once } from 'node:events'
import { createRunner, loadLockedRecipe } from './runner.mjs'
import { run } from './media.mjs'
import { pathToFileURL } from 'node:url'
import { inspectMp4, inspectWav } from './formats.mjs'
import { validateJob } from './contract.mjs'

const exec = promisify(execFile), recipe = 'a'.repeat(64)
let directory, audioVideo, silentVideo, longVideo, webmVideo, movVideo
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
function job(bytes, changes = {}) {
  const jobId = randomUUID()
  return { jobId, videoId: 1, recipe, source: { key: `review-intake/${jobId}/source`, etag: 'source-etag', checksum: digest(bytes), bytes: bytes.length }, contentType: 'video/mp4', outputKey: `review-intake/${jobId}/deliverable.mp4`, maximumBytes: 67108864, maximumDurationMs: 7200000, audioPolicy: { model: '@cf/openai/whisper-large-v3-turbo', maximumChunks: 120, maximumChunkBytes: 2097152, maximumChunkDurationMs: 60000, maximumTranscriptCharacters: 100000 }, startedAt: 100, deadline: 86500, expectedCurrentRevisionId: null, ...changes }
}
async function fixture(name, duration, audio = true, format = 'mp4') {
  const path = join(directory, name)
  await exec('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=10', ...(audio ? ['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=16000'] : []), '-t', String(duration), '-c:v', format === 'webm' ? 'libvpx-vp9' : 'libx264', '-threads', '1', ...(audio ? ['-c:a', format === 'webm' ? 'libopus' : 'aac'] : []), ...(format === 'mp4' ? ['-movflags', '+faststart'] : []), '-f', format, path])
  return readFile(path)
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'review-runner-tests-'))
  audioVideo = await fixture('audio.mp4', 2)
  silentVideo = await fixture('silent.mp4', 1, false)
  longVideo = await fixture('long.mp4', 60.3)
  webmVideo = await fixture('video.webm', 1, true, 'webm')
  movVideo = await fixture('video.mov', 1, true, 'mov')
})
after(async () => { await rm(directory, { recursive: true, force: true }) })
async function server(t, config = {}) {
  const scratch = await mkdtemp(join(directory, 'scratch-'))
  const instance = createRunner({ recipe, scratchRoot: scratch, ...config })
  instance.listen(0, '127.0.0.1'); await once(instance, 'listening')
  t.after(async () => { instance.closeAllConnections(); await new Promise(resolve => instance.close(resolve)) })
  return { url: `http://127.0.0.1:${instance.address().port}`, scratch }
}
function request(url, operation, bytes, manifest = job(bytes), more = {}) {
  return fetch(`${url}/${operation}`, { method: 'POST', headers: { 'x-review-job': JSON.stringify(manifest), 'x-review-recipe': recipe, 'content-type': 'application/octet-stream' }, body: bytes, ...more })
}
async function unpack(response) {
  assert.equal(response.status, 200, response.status === 200 ? undefined : await response.text())
  assert.equal(response.headers.get('content-type'), 'application/vnd.rawkode.review-artifacts')
  const body = Buffer.from(await response.arrayBuffer()), length = body.readUInt32BE(0)
  assert.ok(length <= 65536)
  const manifest = JSON.parse(body.subarray(4, 4 + length)), files = []
  let at = 4 + length
  for (const artifact of manifest.artifacts) {
    const bytes = body.subarray(at, at + artifact.bytes); at += artifact.bytes
    assert.equal(bytes.length, artifact.bytes); assert.equal(digest(bytes), artifact.checksum); files.push(bytes)
  }
  assert.equal(at, body.length)
  return { manifest, files }
}
async function scratchEmpty(scratch) {
  for (let i = 0; i < 100; i++) { if (!(await readdir(scratch)).length) return; await new Promise(resolve => setTimeout(resolve, 10)) }
  assert.deepEqual(await readdir(scratch), [])
}

test('real source is fully decoded and encoded as deterministic H264/AAC fast-start MP4', async t => {
  const { url, scratch } = await server(t), input = job(audioVideo)
  const result = await unpack(await request(url, 'encode', audioVideo, input))
  assert.equal(result.manifest.jobId, input.jobId); assert.equal(result.manifest.operation, 'encode')
  assert.equal(result.manifest.videoCodec, 'h264'); assert.equal(result.manifest.audioCodec, 'aac')
  assert.equal(result.manifest.fullDecode, true); assert.equal(result.manifest.fastStart, true)
  assert.equal(result.manifest.width, 160); assert.equal(result.manifest.height, 90)
  const output = join(directory, 'returned.mp4'); await writeFile(output, result.files[0])
  assert.deepEqual(await inspectMp4(output), { contentType: 'video/mp4', fastStart: true })
  const probe = JSON.parse((await exec('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', output])).stdout)
  assert.deepEqual(probe.streams.map(s => s.codec_name), ['h264', 'aac'])
  const retry = await unpack(await request(url, 'encode', audioVideo, input))
  assert.deepEqual(retry.manifest, result.manifest); assert.deepEqual(retry.files, result.files)
  await scratchEmpty(scratch)
})
test('real audio extraction emits valid contiguous mono 16 kHz PCM WAV chunks', async t => {
  const { url, scratch } = await server(t)
  const { manifest, files } = await unpack(await request(url, 'audio', longVideo))
  assert.equal(manifest.operation, 'audio'); assert.equal(manifest.noAudio, false)
  assert.equal(manifest.artifacts.length, 2)
  assert.deepEqual(manifest.artifacts.map(a => [a.index, a.startMs, a.durationMs]), [[0, 0, 60000], [1, 60000, 300]])
  for (const [index, bytes] of files.entries()) {
    const path = join(directory, `returned-${index}.wav`); await writeFile(path, bytes)
    await inspectWav(path, manifest.artifacts[index].durationMs)
    const probe = JSON.parse((await exec('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', path])).stdout).streams[0]
    assert.equal(probe.codec_name, 'pcm_s16le'); assert.equal(probe.sample_rate, '16000'); assert.equal(probe.channels, 1)
  }
  assert.equal(manifest.artifacts.reduce((n, a) => n + a.durationMs, 0), manifest.durationMs)
  await scratchEmpty(scratch)
})
test('silent media has no fabricated audio and encode preserves silence', async t => {
  const { url } = await server(t)
  const audio = await unpack(await request(url, 'audio', silentVideo))
  assert.equal(audio.manifest.noAudio, true); assert.deepEqual(audio.files, [])
  const encoded = await unpack(await request(url, 'encode', silentVideo))
  assert.equal(encoded.manifest.audioCodec, 'none')
})
test('actual WebM and QuickTime containers are accepted with matching MIME', async t => {
  const { url } = await server(t)
  for (const [bytes, contentType] of [[webmVideo, 'video/webm'], [movVideo, 'video/quicktime']]) {
    const result = await unpack(await request(url, 'encode', bytes, job(bytes, { contentType })))
    assert.equal(result.manifest.source.contentType, contentType)
  }
})
test('SHA mismatch, MIME mismatch, corrupt media, playlists and unknown commands fail closed', async t => {
  const { url, scratch } = await server(t)
  const wrong = job(audioVideo); wrong.source.checksum = '0'.repeat(64)
  assert.equal((await request(url, 'encode', audioVideo, wrong)).status, 422)
  assert.equal((await request(url, 'encode', audioVideo, job(audioVideo, { contentType: 'video/webm' }))).status, 422)
  const corrupt = audioVideo.subarray(0, Math.floor(audioVideo.length / 2))
  assert.equal((await request(url, 'encode', corrupt)).status, 422)
  const playlist = Buffer.from('#EXTM3U\n#EXTINF:1\nfile:///etc/passwd\n')
  assert.equal((await request(url, 'encode', playlist)).status, 422)
  assert.equal((await request(url, 'unknown', audioVideo)).status, 404)
  await scratchEmpty(scratch)
})
test('external MOV data references are rejected before invoking FFmpeg', async t => {
  const { url } = await server(t), external = Buffer.from(audioVideo), at = external.indexOf(Buffer.from('url '))
  assert.ok(at >= 0); external.writeUInt32BE(0, at + 4)
  assert.equal((await request(url, 'encode', external)).status, 422)
})
test('limits, server-owned identities and image recipe are validated before body consumption', async t => {
  const { url } = await server(t), oversized = job(audioVideo)
  oversized.source.bytes = 67108865
  assert.throws(() => validateJob(JSON.stringify(oversized), recipe), /Invalid source/)
  assert.equal((await request(url, 'encode', audioVideo, oversized)).status, 422)
  const wrongKey = job(audioVideo); wrongKey.outputKey = '../deliverable.mp4'
  assert.equal((await request(url, 'encode', audioVideo, wrongKey)).status, 422)
  assert.equal((await request(url, 'encode', audioVideo, job(audioVideo, { recipe: 'b'.repeat(64) }))).status, 422)
  const unknown = job(audioVideo); unknown.ffmpegArgs = ['-i', 'https://example.com']
  assert.equal((await request(url, 'encode', audioVideo, unknown)).status, 422)
  const health = await (await fetch(`${url}/health`)).json(); assert.deepEqual(health, { protocol: 1, recipe })
})
test('declared source lengths and actual short streams cannot bypass integrity', async t => {
  const { url } = await server(t), input = job(audioVideo)
  assert.equal((await request(url, 'encode', audioVideo.subarray(0, 50), input)).status, 422)
  const stream = new ReadableStream({ start(controller) { controller.enqueue(audioVideo.subarray(0, 50)); controller.close() } })
  assert.equal((await request(url, 'encode', stream, input, { duplex: 'half' })).status, 422)
})
test('unavailable executable does not emit partial evidence', async t => {
  const { url, scratch } = await server(t, { ffmpeg: join(directory, 'missing') })
  assert.equal((await request(url, 'encode', audioVideo)).status, 503)
  await scratchEmpty(scratch)
})
test('deadline kills a stalled child and cleans private scratch files', async t => {
  const stall = join(directory, 'stall.mjs')
  await writeFile(stall, '#!/usr/bin/env node\nsetInterval(() => {}, 1000)\n', { mode: 0o700 })
  const { url, scratch } = await server(t, { ffmpeg: stall, timeoutMs: 300 })
  assert.equal((await request(url, 'encode', audioVideo)).status, 408)
  await scratchEmpty(scratch)
})
test('disconnect cancels processing and releases capacity', async t => {
  const stall = join(directory, 'stall.mjs')
  await writeFile(stall, '#!/usr/bin/env node\nsetInterval(() => {}, 1000)\n', { mode: 0o700 })
  const { url, scratch } = await server(t, { ffmpeg: stall, maxConcurrent: 1 })
  const controller = new AbortController(), pending = request(url, 'encode', audioVideo, job(audioVideo), { signal: controller.signal })
  pending.catch(() => {})
  for (let i = 0; i < 100 && !(await readdir(scratch)).length; i++) await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal((await request(url, 'encode', audioVideo)).status, 503)
  controller.abort(); await assert.rejects(pending); await scratchEmpty(scratch)
})


test('production lock verifies the recipe and every executable module', async () => {
  const root = await mkdtemp(join(directory, 'lock-')), files = {}
  for (const name of ['contract.mjs', 'formats.mjs', 'media.mjs', 'runner.mjs']) {
    const bytes = await readFile(new URL(name, import.meta.url)); files[name] = digest(bytes)
    await writeFile(join(root, name), bytes)
  }
  const inputs = { files }, lock = { recipe: digest(JSON.stringify(inputs)), inputs }, url = pathToFileURL(join(root, 'recipe.json'))
  await writeFile(url, JSON.stringify(lock))
  assert.equal(await loadLockedRecipe(url), lock.recipe)
  await writeFile(join(root, 'media.mjs'), '// changed')
  await assert.rejects(loadLockedRecipe(url), /module integrity/)
  await writeFile(url, JSON.stringify({ ...lock, recipe: '0'.repeat(64) }))
  await assert.rejects(loadLockedRecipe(url), /Recipe integrity/)
})
test('nonzero decoder exit never emits partial evidence', async t => {
  const failed = join(directory, 'failed.mjs')
  await writeFile(failed, '#!/usr/bin/env node\nprocess.stdout.write("partial"); process.exit(1)\n', { mode: 0o700 })
  const { url, scratch } = await server(t, { ffmpeg: failed })
  const response = await request(url, 'encode', audioVideo)
  assert.equal(response.status, 422); assert.match(await response.text(), /decoding or encoding failed/)
  await scratchEmpty(scratch)
})
test('a child exceeding the disk watchdog is killed', async () => {
  const path = join(directory, 'oversized.tmp')
  await assert.rejects(run(process.execPath, ['-e', 'require("node:fs").writeFileSync(process.argv[1], Buffer.alloc(2097152)); setInterval(()=>{},1000)', path], AbortSignal.timeout(3000), { path, bytes: 1024 }), /size limit/)
})
test('probe JSON output cannot grow without bound', async () => {
  await assert.rejects(run(process.execPath, ['-e', 'process.stdout.write("x".repeat(131072)); setInterval(()=>{},1000)'], AbortSignal.timeout(3000)), /Probe output exceeded/)
})
test('an oversized chunked source aborts and cleans scratch', async t => {
  const { url, scratch } = await server(t), input = job(audioVideo)
  input.source.bytes = 20
  const stream = new ReadableStream({ start(controller) { controller.enqueue(audioVideo); controller.close() } })
  // Depending on socket timing Node may send the rejection or close the upload.
  const response = await request(url, 'encode', stream, input, { duplex: 'half' }).catch(() => null)
  assert.ok(response === null || response.status === 422)
  await scratchEmpty(scratch)
})
