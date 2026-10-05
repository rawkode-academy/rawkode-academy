import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { once } from 'node:events'
import { maximumBytes, Rejection, validateJob } from './contract.mjs'
import { encode, extractAudio, inspectSource } from './media.mjs'

async function receive(request, path, job, signal) {
  const hash = createHash('sha256')
  let bytes = 0
  const measured = new Transform({ transform(part, encoding, callback) {
    bytes += part.length
    if (bytes > job.source.bytes) callback(new Rejection('Source exceeds its declared size'))
    else { hash.update(part); callback(null, part) }
  } })
  await pipeline(request, measured, createWriteStream(path, { flags: 'wx', mode: 0o600 }), { signal })
  if (bytes !== job.source.bytes || hash.digest('hex') !== job.source.checksum) throw new Rejection('Source size or SHA-256 mismatch')
}
async function write(response, bytes, signal) {
  signal.throwIfAborted()
  if (!response.write(bytes)) await once(response, 'drain', { signal })
}
/** Config injection is only for direct local tests; the executable entrypoint
 * always loads the image-baked recipe and fixed executable names. */
export function createRunner({ recipe, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', timeoutMs = 105000, maxConcurrent = 2, scratchRoot = tmpdir() }) {
  if (!/^[a-f0-9]{64}$/.test(recipe) || !Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 2) throw new Error('Invalid runner configuration')
  let active = 0, reserved = 0
  const server = createServer({ maxHeaderSize: 16384, requestTimeout: timeoutMs }, async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ protocol: 1, recipe })); return }
    const operation = request.url === '/encode' ? 'encode' : request.url === '/audio' ? 'audio' : null
    if (request.method !== 'POST' || !operation) { response.writeHead(404); response.end(); return }
    // Reserve the worst-case scratch requirement before reading any source. Two
    // encodes or one encode + audio fit a 512 MiB scratch mount; two audio jobs do not.
    const reservation = maximumBytes + (operation === 'audio' ? 120 * 2097152 : maximumBytes + 1048576)
    if (active >= maxConcurrent || reserved + reservation > 448 * 1024 * 1024) { response.writeHead(503, { 'retry-after': '5' }); response.end('Runner capacity exhausted'); return }
    active++; reserved += reservation
    const controller = new AbortController(), { signal } = controller
    const timer = setTimeout(() => controller.abort(new Rejection('Processing deadline exceeded', 408)), timeoutMs)
    const disconnected = () => { if (!response.writableFinished) controller.abort(new Rejection('Client disconnected', 408)) }
    request.once('aborted', disconnected); response.once('close', disconnected)
    let directory
    try {
      if (request.headers['x-review-recipe'] !== recipe) throw new Rejection('Image recipe mismatch', 409)
      const job = validateJob(request.headers['x-review-job'], recipe)
      if (request.headers['content-length'] && Number(request.headers['content-length']) !== job.source.bytes) throw new Rejection('Source length header mismatch')
      directory = await mkdtemp(join(scratchRoot, 'review-'))
      const source = join(directory, 'source'), context = { ffmpeg, ffprobe, signal }
      await receive(request, source, job, signal)
      const media = await inspectSource(source, job, context)
      const output = operation === 'encode' ? await encode(source, directory, media, context) : await extractAudio(source, directory, media, context)
      const manifest = { protocol: 1, operation, jobId: job.jobId, recipe, source: { contentType: media.contentType }, ...output.fields, artifacts: output.artifacts }
      const json = Buffer.from(JSON.stringify(manifest)), length = Buffer.alloc(4)
      if (json.length > 65536) throw new Rejection('Manifest exceeds its byte limit')
      length.writeUInt32BE(json.length)
      response.writeHead(200, { 'content-type': 'application/vnd.rawkode.review-artifacts', 'content-length': 4 + json.length + output.artifacts.reduce((n, a) => n + a.bytes, 0), 'cache-control': 'no-store' })
      await write(response, length, signal); await write(response, json, signal)
      for (const path of output.files) for await (const part of createReadStream(path, { signal })) await write(response, part, signal)
      const finished = once(response, 'finish', { signal })
      response.end(); await finished
    } catch (error) {
      if (!response.headersSent && !response.destroyed) {
        response.writeHead(error instanceof Rejection ? error.status : signal.aborted ? 408 : 422, { 'content-type': 'application/json', 'connection': 'close' })
        response.end(JSON.stringify({ error: error instanceof Rejection ? error.message : 'Media processing failed' }))
      } else response.destroy()
    } finally {
      clearTimeout(timer); request.removeListener('aborted', disconnected); response.removeListener('close', disconnected)
      if (directory) await rm(directory, { recursive: true, force: true })
      active--; reserved -= reservation
    }
  })
  server.headersTimeout = Math.min(timeoutMs, 30000)
  return server
}
export async function loadLockedRecipe(recipeUrl = new URL('./recipe.json', import.meta.url)) {
  const lock = JSON.parse(await readFile(recipeUrl, 'utf8'))
  const digest = data => createHash('sha256').update(data).digest('hex')
  if (!lock.inputs || digest(JSON.stringify(lock.inputs)) !== lock.recipe) throw new Error('Recipe integrity mismatch')
  const files = lock.inputs.files
  if (!files || !['contract.mjs', 'formats.mjs', 'media.mjs', 'runner.mjs'].every(name => /^[a-f0-9]{64}$/.test(files[name]))) throw new Error('Recipe is missing runner module hashes')
  for (const [name, checksum] of Object.entries(files)) {
    if (!/^[a-zA-Z0-9._-]+$/.test(name) || digest(await readFile(new URL(name, recipeUrl))) !== checksum) throw new Error('Runner module integrity mismatch')
  }
  return lock.recipe
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const recipe = await loadLockedRecipe()
  createRunner({ recipe }).listen(8080, '0.0.0.0')
}
