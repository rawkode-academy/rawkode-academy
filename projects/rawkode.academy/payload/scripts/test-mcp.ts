import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

// This script intentionally accepts only the local workerd test address.
const base = 'http://127.0.0.1:3100'
const credentials = JSON.parse(readFileSync('.runtime/admin.json', 'utf8'))
const checks: string[] = []
let jwt = ''
let keyId: number | string | undefined
let videoId: number | string | undefined
let session: string | null = null
const apiKey = randomBytes(32).toString('hex')
let sequence = 0

async function rest(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(base + path, {
    method, signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `JWT ${jwt}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  // Never emit response bodies from credential endpoints.
  assert(response.ok, `REST ${method} ${path} returned ${response.status}`)
  return text ? JSON.parse(text) : null
}
async function rpc(method: string, params: unknown = {}, key: string | null = apiKey) {
  const id = ++sequence
  const response = await fetch(base + '/api/mcp', {
    method: 'POST', signal: AbortSignal.timeout(20000), headers: {
      'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(session ? { 'mcp-session-id': session } : {}),
    }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
  session = response.headers.get('mcp-session-id') ?? session
  if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const blocks = buffer.split(/\r?\n\r?\n/)
        buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n')
          if (data) {
            const body = JSON.parse(data)
            if (body.id === id) return { status: response.status, body }
          }
        }
        if (done) throw new Error(`MCP ${method}: stream closed without response`)
      }
    } finally { await reader.cancel() }
  }
  const text = await response.text()
  let body: any
  try {
    body = text.startsWith('event:') || text.startsWith('data:')
      ? JSON.parse(text.split('\n').filter(line => line.startsWith('data:')).at(-1)!.slice(5))
      : JSON.parse(text)
  } catch { throw new Error(`MCP ${method}: non-JSON response HTTP ${response.status}`) }
  return { status: response.status, body }
}
async function call(name: string, args: Record<string, unknown> = {}) {
  const { status, body } = await rpc('tools/call', { name, arguments: args })
  assert.equal(status, 200, `MCP tool ${name}: HTTP ${status}`)
  assert(!body.error, `MCP tool ${name}: ${body.error?.message}`)
  assert(!body.result?.isError, `MCP tool ${name}: returned isError`)
  const text = body.result?.content?.map((item: any) => item.text ?? '').join('\n') ?? ''
  assert(!/Error|❌/.test(text), `MCP tool ${name} returned an operation error: ${text.slice(0, 400)}`)
  return text
}
async function publicVideo(legacyId: string) {
  const response = await fetch(base + '/graphql', {
    method: 'POST', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query($id: String!) { videoByID(id: $id) { id title } }', variables: { id: legacyId } }),
  })
  const body: any = await response.json()
  assert(!body.errors, 'Compatibility query failed')
  return body.data.videoByID
}

try {
  const runtime = await rest('/api/poc/runtime')
  assert(/workerd|cloudflare-workers/i.test(runtime.runtime ?? ''), 'Test must run on workerd, not next dev')
  assert(runtime.bindings?.D1 && runtime.bindings?.R2, 'Local Cloudflare bindings missing')
  jwt = (await rest('/api/users/login', 'POST', credentials)).token
  assert(jwt, 'Local staff login returned no token')
  checks.push('actual workerd runtime; local staff login')
  const denied = await rpc('tools/list', {}, null)
  assert(denied.status === 401 || denied.status === 403, 'Anonymous MCP must be rejected')
  checks.push('anonymous MCP rejected')
  const key = await rest('/api/payload-mcp-api-keys', 'POST', {
    label: 'Disposable local workerd MCP test', enableAPIKey: true, apiKey,
    videos: { find: true, create: true, update: true },
    academySettings: { find: true, update: true },
    'payload-mcp-tool': { academyImportStatus: true },
    'payload-mcp-resource': { academyCompatibilityPolicy: true },
  })
  keyId = key.doc.id
  const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'local-worker-poc-test', version: '0.0.0' } })
  assert.equal(init.status, 200, `MCP initialize returned ${init.status}`)
  assert(!init.body.error, `MCP initialization error: ${init.body.error?.message}`)
  const listing = await rpc('tools/list')
  assert.equal(listing.status, 200, `MCP discovery HTTP ${listing.status}`)
  assert(!listing.body.error, `MCP discovery error: ${listing.body.error?.message}`)
  const tools = listing.body.result.tools
  const names = tools.map((tool: any) => tool.name)
  for (const name of ['findVideos', 'createVideos', 'updateVideos', 'findAcademySettings', 'updateAcademySettings', 'academyImportStatus']) assert(names.includes(name), `Missing tool: ${name}`)
  assert(!names.some((name: string) => /delete|Users|Config|Jobs|Media|Articles/.test(name)), 'Unexpected destructive or ungranted tool')
  checks.push('collection/global/custom discovery; delete and ungranted collections absent')
  // workerd bans new Function. Assert schema fidelity instead of accepting a
  // successful tools/list that silently fell back to empty create/update inputs.
  const createSchema = tools.find((tool: any) => tool.name === 'createVideos').inputSchema
  const createSchemaHasFields = Boolean(createSchema.properties?.legacyId && createSchema.properties?.title)
  checks.push(createSchemaHasFields ? 'create input schema includes legacyId/title' : 'FAIL: create input schema lost legacyId/title; testing actual create next')
  const resources = await rpc('resources/list')
  assert(!resources.body.error, 'MCP resource discovery failed')
  assert(resources.body.result.resources.some((resource: any) => resource.uri === 'academy://compatibility/policy'))
  const policy = await rpc('resources/read', { uri: 'academy://compatibility/policy' })
  assert(policy.body.result?.contents?.some((item: any) => item.text?.includes('provenance')), 'MCP resource read failed')
  checks.push('custom resource discovery/read')
  const legacyId = `mcp-local-${Date.now()}`
  await call('createVideos', { legacyId, legacyType: 'Video', slug: legacyId, title: 'MCP draft', _status: 'draft', draft: true, type: 'recorded' })
  const created = await rest(`/api/videos?where[legacyId][equals]=${legacyId}&draft=true`)
  assert.equal(created.docs.length, 1)
  videoId = created.docs[0].id
  assert(createSchemaHasFields, 'MCP create succeeded but discovery lost field definitions; schema-fidelity gate fails')
  assert.equal(await publicVideo(legacyId), null)
  await call('findVideos', { id: videoId, draft: true })
  checks.push('MCP draft create/read hidden from public compatibility query')
  await call('updateVideos', { id: videoId, title: 'MCP approved publication', _status: 'published', draft: false, overrideLock: false })
  assert.deepEqual(await publicVideo(legacyId), { id: legacyId, title: 'MCP approved publication' })
  checks.push('MCP update/publish reflected through stable compatibility ID')
  await call('updateAcademySettings', { editorialNote: 'Local workerd MCP test completed' })
  assert((await call('findAcademySettings')).includes('Local workerd MCP test completed'))
  await call('academyImportStatus')
  checks.push('global read/write and custom access-controlled import status')
  await rest(`/api/payload-mcp-api-keys/${keyId}`, 'PATCH', { videos: { find: true, create: false, update: false } })
  const restricted = await rpc('tools/list')
  assert(!restricted.body.result.tools.some((tool: any) => ['createVideos', 'updateVideos'].includes(tool.name)))
  const forbidden = await rpc('tools/call', { name: 'updateVideos', arguments: { id: videoId, title: 'must not change' } })
  assert(forbidden.body.error || forbidden.body.result?.isError)
  checks.push('live per-key write revocation enforced')
  await rest(`/api/payload-mcp-api-keys/${keyId}`, 'DELETE')
  keyId = undefined
  const revoked = await rpc('tools/list')
  assert(revoked.status === 401 || revoked.status === 403)
  checks.push('deleted key rejected immediately')
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', checks, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exitCode = 1
} finally {
  if (videoId !== undefined) await rest(`/api/videos/${videoId}`, 'DELETE').catch(() => console.error('Local test video cleanup failed'))
  if (keyId !== undefined) await rest(`/api/payload-mcp-api-keys/${keyId}`, 'DELETE').catch(() => console.error('Local MCP test key cleanup failed'))
}
