import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { renderD2 } from './render.mjs'

const MAX_SOURCE_BYTES = 64 * 1024
const MAX_SVG_BYTES = 2 * 1024 * 1024
const VERSION = '0.1.33'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const normalize = source => source.replace(/\r\n/g, '\n').trim()

async function readSource(request) {
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > MAX_SOURCE_BYTES) throw Object.assign(new Error('D2 source exceeds 64 KiB'), { status: 413 })
    chunks.push(chunk)
  }
  let source
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)) }
  catch { throw Object.assign(new Error('D2 source must be UTF-8'), { status: 400 }) }
  source = normalize(source)
  if (!source) throw Object.assign(new Error('D2 source is empty'), { status: 400 })
  return { source, checksum: hash(Buffer.from(source, 'utf8')) }
}

function safeSvg(value) {
  if (typeof value !== 'string') throw new Error('Renderer did not return SVG text')
  const svg = value.trim(), bytes = Buffer.byteLength(svg, 'utf8')
  if (bytes > MAX_SVG_BYTES || !svg.startsWith('<svg') || !svg.endsWith('</svg>')) throw new Error('Renderer returned invalid or oversized SVG')
  if (/<\s*(?:script|foreignObject)\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:)/i.test(svg)) throw new Error('Renderer returned unsafe SVG markup')
  return { svg, checksum: hash(Buffer.from(svg, 'utf8')) }
}

/** Configurable for protocol tests; production uses the image-baked D2 package. */
export function createRunner({ render = renderD2, timeoutMs = 15000, maxConcurrent = 1 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000 || maxConcurrent !== 1) throw new Error('Invalid D2 renderer limits')
  let active = 0
  const server = createServer({ maxHeaderSize: 16384, requestTimeout: timeoutMs + 1000 }, async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      response.end(JSON.stringify({ protocol: 1, d2Version: VERSION }))
      return
    }
    if (request.method !== 'POST' || request.url !== '/render') { response.writeHead(404); response.end(); return }
    if (active >= maxConcurrent) { response.writeHead(503, { 'retry-after': '5' }); response.end(); return }
    active++
    let released = false
    let renderingStarted = false
    const release = () => { if (!released) { released = true; active-- } }
    let deadlineTimer
    const timer = setTimeout(() => {
      if (!response.headersSent && !response.destroyed) { response.writeHead(408, { 'connection': 'close' }); response.end() }
    }, timeoutMs)
    try {
      const declared = request.headers['content-length']
      if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_SOURCE_BYTES)) throw Object.assign(new Error('Invalid source length'), { status: 413 })
      const { source, checksum } = await readSource(request)
      if (request.headers['x-source-checksum'] !== checksum) throw Object.assign(new Error('D2 source checksum mismatch'), { status: 409 })
      const rendering = Promise.resolve().then(() => render(source))
      renderingStarted = true
      rendering.finally(release).catch(() => {})
      const value = await Promise.race([rendering, new Promise((_, reject) => { deadlineTimer = setTimeout(() => reject(Object.assign(new Error('D2 render deadline exceeded'), { status: 408 })), timeoutMs) })])
      const result = safeSvg(value)
      if (!response.destroyed && !response.headersSent) {
        response.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'content-length': String(Buffer.byteLength(result.svg)), 'x-content-checksum': result.checksum, 'cache-control': 'no-store' })
        response.end(result.svg)
      }
    } catch (error) {
      if (!response.destroyed && !response.headersSent) {
        const status = Number.isInteger(error?.status) ? error.status : 422
        response.writeHead(status, { 'content-type': 'application/json', 'connection': 'close' })
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'D2 render failed' }))
      }
    } finally {
      clearTimeout(timer)
      if (deadlineTimer) clearTimeout(deadlineTimer)
      // If render timed out, keep the single slot reserved until its worker settles.
      if (!renderingStarted) release()
    }
  })
  server.headersTimeout = 5000
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) createRunner().listen(8080, '0.0.0.0')
