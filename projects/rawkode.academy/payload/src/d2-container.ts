import { DurableObject } from 'cloudflare:workers'
import { d2SourceHash, d2SourceMaximumBytes, normalizeD2Source, putD2Artifact, type DiagramResult } from './diagrams'

const d2Version = '0.1.33'
const maximumSvgBytes = 2 * 1024 * 1024
type D2Runtime = { R2: R2Bucket }

async function boundedText(body: ReadableStream<Uint8Array> | null, maximum: number): Promise<string> {
  if (!body) throw new Error('D2 container response is empty')
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maximum) throw new Error('D2 container response exceeds its byte limit')
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

/** Internal only: Payload's admin Worker invokes this DO; Astro only sees R2-backed SVG reads. */
export class D2RenderContainer extends DurableObject<D2Runtime> {
  private async render(source: string, sourceHash: string): Promise<{ svg: string; checksum: string }> {
    const container = this.ctx.container
    if (!container) throw new Error('D2 container runtime binding is unavailable')
    if (!container.running) container.start({ enableInternet: false })
    await container.setInactivityTimeout(60000)
    const port = container.getTcpPort(8080)
    const deadline = Date.now() + 10000
    let ready = false
    while (!ready && Date.now() < deadline) {
      try {
        const response = await port.fetch('http://container/health', { signal: AbortSignal.timeout(1000) })
        const health = await response.json() as { protocol?: unknown; d2Version?: unknown }
        if (response.ok && health.protocol === 1 && health.d2Version === d2Version) ready = true
        else throw new Error('D2 container version does not match the Worker')
      } catch (error) {
        if (error instanceof Error && error.message.includes('version does not match')) throw error
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    if (!ready) throw new Error('D2 container did not become ready')
    const bytes = new TextEncoder().encode(source)
    const response = await port.fetch('http://container/render', {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
      headers: { 'content-type': 'text/plain; charset=utf-8', 'content-length': String(bytes.byteLength), 'x-source-checksum': sourceHash },
      body: bytes,
    })
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'image/svg+xml') throw new Error(`D2 container returned ${response.status}`)
    const declared = Number(response.headers.get('content-length'))
    if (!Number.isSafeInteger(declared) || declared < 1 || declared > maximumSvgBytes) throw new Error('D2 container returned invalid SVG size')
    const checksum = response.headers.get('x-content-checksum')
    if (!checksum || !/^[a-f0-9]{64}$/.test(checksum)) throw new Error('D2 container returned invalid checksum evidence')
    const svg = await boundedText(response.body, maximumSvgBytes)
    if (new TextEncoder().encode(svg).byteLength !== declared) throw new Error('D2 container SVG size does not match its response')
    return { svg, checksum }
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url)
      const match = /^\/v1\/render\/([a-f0-9]{64})$/.exec(url.pathname)
      if (request.method !== 'POST' || !match || url.searchParams.size || request.headers.get('content-type')?.split(';')[0] !== 'text/plain') return Response.json({ error: 'Not found' }, { status: 404 })
      const sourceHash = match[1]!
      const declaredHeader = request.headers.get('content-length')
      const declared = declaredHeader === null ? null : Number(declaredHeader)
      if (declared !== null && (!Number.isSafeInteger(declared) || declared < 1 || declared > d2SourceMaximumBytes)) return Response.json({ error: 'Invalid D2 source size' }, { status: 413 })
      const source = normalizeD2Source(await boundedText(request.body, d2SourceMaximumBytes))
      const sourceBytes = new TextEncoder().encode(source).byteLength
      if (sourceBytes < 1 || sourceBytes > d2SourceMaximumBytes || (declared !== null && sourceBytes !== declared) || await d2SourceHash(source) !== sourceHash) return Response.json({ error: 'D2 source checksum mismatch' }, { status: 409 })
      const key = `derived-diagrams/${sourceHash}.svg`
      const existing = await this.env.R2.head(key)
      if (existing) {
        const result = { sourceChecksum: existing.customMetadata?.sourceChecksum, svgChecksum: existing.customMetadata?.svgChecksum }
        if (result.sourceChecksum === sourceHash && /^[a-f0-9]{64}$/.test(String(result.svgChecksum)) && existing.size <= maximumSvgBytes) return Response.json(result satisfies DiagramResult)
        return Response.json({ error: 'Invalid existing D2 artifact' }, { status: 500 })
      }
      const rendered = await this.render(source, sourceHash)
      const result = await putD2Artifact(this.env.R2, sourceHash, rendered.svg)
      if (rendered.checksum !== result.svgChecksum) return Response.json({ error: 'D2 artifact checksum mismatch' }, { status: 502 })
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'D2 rendering failed' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
    }
  }
}
