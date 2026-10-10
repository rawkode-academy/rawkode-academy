export const d2SourceMaximumBytes = 64 * 1024
export const d2SvgMaximumBytes = 2 * 1024 * 1024
const sha256Pattern = /^[a-f0-9]{64}$/

export function normalizeD2Source(source: string): string {
  return source.replace(/\r\n/g, '\n').trim()
}

export async function d2SourceHash(source: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(normalizeD2Source(source)))
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export type D2Source = { source: string; sourceHash: string }

/** Extract only fenced D2 blocks and apply the same normalization used by the website. */
export async function d2SourcesFromBody(body: string | undefined): Promise<D2Source[]> {
  if (!body) return []
  const sources: D2Source[] = []
  for (const match of body.matchAll(/```d2(?:\s+[^\n]*)?\s*\n([\s\S]*?)\n```/gi)) {
    const source = normalizeD2Source(match[1] ?? '')
    if (!source) continue
    if (new TextEncoder().encode(source).byteLength > d2SourceMaximumBytes) throw new Error('D2 source exceeds 64 KiB')
    sources.push({ source, sourceHash: await d2SourceHash(source) })
    if (sources.length > 16) throw new Error('A document may contain at most 16 D2 diagrams')
  }
  return [...new Map(sources.map(item => [item.sourceHash, item])).values()]
}

export function diagramObjectKey(sourceHash: string): string {
  if (!sha256Pattern.test(sourceHash)) throw new Error('Invalid D2 source checksum')
  return `derived-diagrams/${sourceHash}.svg`
}

export type DiagramResult = { sourceChecksum: string; svgChecksum: string }

function validDiagramResult(value: unknown, sourceHash: string): value is DiagramResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return result.sourceChecksum === sourceHash && typeof result.svgChecksum === 'string' && sha256Pattern.test(result.svgChecksum)
}

/** Make the narrowly scoped render request to the Payload-owned container Durable Object. */
export async function ensureD2Artifact(source: D2Source, renderer?: DurableObjectNamespace): Promise<DiagramResult> {
  if (!renderer) throw new Error('D2 renderer binding is unavailable')
  const response = await renderer.getByName('public-d2-renderer-v1').fetch(new Request(
    `https://d2-renderer.internal/v1/render/${source.sourceHash}`,
    { method: 'POST', headers: { 'content-type': 'text/plain; charset=utf-8' }, body: source.source },
  ))
  if (!response.ok) throw new Error(`D2 renderer returned ${response.status}`)
  const value: unknown = await response.json()
  if (!validDiagramResult(value, source.sourceHash)) throw new Error('D2 renderer returned invalid checksum evidence')
  return value
}

export async function ensureD2ArtifactsForBody(body: string | undefined, renderer?: DurableObjectNamespace): Promise<DiagramResult[]> {
  const sources = await d2SourcesFromBody(body)
  return Promise.all(sources.map(source => ensureD2Artifact(source, renderer)))
}

export async function putD2Artifact(bucket: R2Bucket, sourceHash: string, svg: string): Promise<DiagramResult> {
  if (!sha256Pattern.test(sourceHash)) throw new Error('Invalid D2 source checksum')
  const normalizedSvg = svg.trim()
  const bytes = new TextEncoder().encode(normalizedSvg)
  if (bytes.byteLength > d2SvgMaximumBytes || !normalizedSvg.startsWith('<svg') || !normalizedSvg.endsWith('</svg>')) throw new Error('D2 renderer produced an invalid or oversized SVG')
  if (/<\s*(?:script|foreignObject)\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:)/i.test(normalizedSvg)) throw new Error('D2 renderer produced unsafe SVG markup')
  const svgChecksum = await sha256Hex(bytes)
  const key = diagramObjectKey(sourceHash)
  const previous = await bucket.head(key)
  if (previous) {
    if (previous.customMetadata?.sourceChecksum !== sourceHash || previous.customMetadata?.svgChecksum !== svgChecksum || previous.size !== bytes.byteLength) throw new Error('An immutable D2 artifact already exists with different bytes')
    return { sourceChecksum: sourceHash, svgChecksum }
  }
  const written = await bucket.put(key, bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'image/svg+xml; charset=utf-8', cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { sourceChecksum: sourceHash, svgChecksum },
  })
  if (!written) {
    const raced = await bucket.head(key)
    if (raced?.customMetadata?.sourceChecksum === sourceHash && raced.customMetadata?.svgChecksum === svgChecksum && raced.size === bytes.byteLength) return { sourceChecksum: sourceHash, svgChecksum }
    throw new Error('Could not persist immutable D2 artifact')
  }
  return { sourceChecksum: sourceHash, svgChecksum }
}
