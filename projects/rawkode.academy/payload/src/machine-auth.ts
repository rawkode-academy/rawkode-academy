import type { Payload } from 'payload'

/**
 * The one machine-to-machine scheme for every Rawkode Studio -> Payload call
 * (the review handoff today, broadcast-time calls in workstream F next).
 *
 * Transport: Studio's PAYLOAD service binding to rawkode-academy-payload, default
 * entrypoint. The request carries no cookie, so the OIDC CSRF gate in ingress.ts
 * never applies, and it carries no browser origin.
 *
 * Signature: HMAC-SHA256 with a secret shared through Cloudflare Secrets Store
 * (STUDIO_MACHINE_SECRET, bound by both Workers) over this canonical string:
 *
 *   RAWKODE-HMAC-SHA256\n
 *   <METHOD>\n
 *   <route path, a fixed constant chosen by the receiving route>\n
 *   <canonical query: sorted key=value pairs, RFC 3986 encoded, joined by &>\n
 *   <principal>\n
 *   <unix seconds>\n
 *   <Idempotency-Key header, or empty>\n
 *   <hex sha256 of the exact body bytes>
 *
 * Headers: x-rawkode-principal, x-rawkode-timestamp, idempotency-key and
 * x-rawkode-signature: v1=<hex>. The verifier signs over the path constant of
 * the route that received the request, never over request.url, so OpenNext URL
 * normalisation cannot change the signature, while a signature captured for one
 * route still fails on every other route.
 *
 * Freshness and replay: the timestamp must be within MACHINE_AUTH_MAX_SKEW_SECONDS
 * of the receiver's clock. Every non-GET request must carry an Idempotency-Key,
 * which is signed, and the endpoint must treat a repeated key as a replay that
 * returns the original result and never applies a second effect. A captured
 * request replayed inside the window therefore changes nothing.
 *
 * To add an endpoint: choose a path constant, call verifyMachineRequest with it and
 * the expected principal, and make the operation idempotent on the key. The
 * calling side uses the Studio client in projects/rawkode.studio/src/server/machine-auth.ts,
 * which must keep MACHINE_AUTH_TEST_VECTOR byte-identical with this file.
 */
export const MACHINE_AUTH_SCHEME = 'RAWKODE-HMAC-SHA256'
export const MACHINE_AUTH_MAX_SKEW_SECONDS = 300
export const MACHINE_AUTH_MAX_BODY_BYTES = 16384
export const machineAuthHeaders = { principal: 'x-rawkode-principal', timestamp: 'x-rawkode-timestamp', idempotencyKey: 'idempotency-key', signature: 'x-rawkode-signature' } as const
// Each caller is also a provisioned users row so review commands keep a real actor.
// identityKey values with the system: prefix never come from OIDC (those are sha256 hex).
export const machinePrincipals = {
  'rawkode-studio': { identityKey: 'system:rawkode-studio', name: 'Rawkode Studio', email: 'rawkode-studio@system.invalid' },
} as const
export type MachinePrincipal = keyof typeof machinePrincipals
export type SecretSource = string | { get(): Promise<string> }
export class MachineAuthError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export const SYSTEM_IDENTITY_PREFIX = 'system:'
export function isSystemIdentity(identityKey: unknown): boolean {
  return typeof identityKey === 'string' && identityKey.startsWith(SYSTEM_IDENTITY_PREFIX)
}
// SQL twin of isSystemIdentity for a users alias. Local staff accounts have no identity key.
export const humanUserSql = (alias = 'users') => `(${alias}.identity_key IS NULL OR substr(${alias}.identity_key,1,${SYSTEM_IDENTITY_PREFIX.length})<>'${SYSTEM_IDENTITY_PREFIX}')`

const encoder = new TextEncoder()
const hexOf = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
export async function sha256Hex(body: Uint8Array | string) {
  return hexOf(await crypto.subtle.digest('SHA-256', typeof body === 'string' ? encoder.encode(body) : body as BufferSource))
}
const rfc3986 = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
export function canonicalQuery(params: URLSearchParams | string) {
  const entries = [...new URLSearchParams(params).entries()].map(([key, value]) => [rfc3986(key), rfc3986(value)])
  entries.sort(([a, x], [b, y]) => a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0)
  return entries.map(([key, value]) => `${key}=${value}`).join('&')
}
export type CanonicalParts = { method: string; path: string; query: string; principal: string; timestamp: number; idempotencyKey: string | null; bodySha256: string }
export function canonicalRequest(parts: CanonicalParts) {
  return [MACHINE_AUTH_SCHEME, parts.method.toUpperCase(), parts.path, parts.query, parts.principal, String(parts.timestamp), parts.idempotencyKey ?? '', parts.bodySha256].join('\n')
}
export async function resolveSecret(secret: SecretSource | null | undefined) {
  if (!secret) return null
  let value: string
  // An unset Secrets Store secret rejects; treat it exactly like a missing binding.
  try { value = typeof secret === 'string' ? secret : await secret.get() } catch { return null }
  return value && value.length >= 32 ? value : null
}
const hmacKey = (secret: string, usage: KeyUsage) => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])

export async function signMachineRequest(secret: string, request: { method: string; path: string; query?: string; principal: MachinePrincipal; timestamp: number; idempotencyKey?: string | null; body?: string }) {
  const canonical = canonicalRequest({ method: request.method, path: request.path, query: canonicalQuery(request.query ?? ''), principal: request.principal, timestamp: request.timestamp, idempotencyKey: request.idempotencyKey ?? null, bodySha256: await sha256Hex(request.body ?? '') })
  const signature = hexOf(await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), encoder.encode(canonical)))
  return {
    [machineAuthHeaders.principal]: request.principal,
    [machineAuthHeaders.timestamp]: String(request.timestamp),
    ...(request.idempotencyKey ? { [machineAuthHeaders.idempotencyKey]: request.idempotencyKey } : {}),
    [machineAuthHeaders.signature]: `v1=${signature}`,
  } as Record<string, string>
}

async function readCapped(request: Request, limit: number) {
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    length += value.length
    if (length > limit) { await reader.cancel(); throw new MachineAuthError(413, 'Machine request body is too large') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return bytes
}

export type VerifiedMachineRequest = { principal: MachinePrincipal; timestamp: number; idempotencyKey: string | null; body: string; json(): unknown }
export async function verifyMachineRequest(request: Request, options: { path: string; principal: MachinePrincipal; secret: SecretSource | null | undefined; now?: () => number; maxBodyBytes?: number }): Promise<VerifiedMachineRequest> {
  const secret = await resolveSecret(options.secret)
  if (!secret) throw new MachineAuthError(503, 'Machine authentication is not configured')
  const headers = request.headers
  const unauthorized = () => new MachineAuthError(401, 'Invalid machine signature')
  if (headers.has('cookie')) throw unauthorized()
  if (headers.get(machineAuthHeaders.principal) !== options.principal) throw unauthorized()
  const timestampHeader = headers.get(machineAuthHeaders.timestamp) ?? ''
  if (!/^[1-9]\d{0,11}$/.test(timestampHeader)) throw unauthorized()
  const timestamp = Number(timestampHeader)
  const now = Math.floor((options.now ?? Date.now)() / 1000)
  if (Math.abs(now - timestamp) > MACHINE_AUTH_MAX_SKEW_SECONDS) throw new MachineAuthError(401, 'Machine request expired')
  const idempotencyKey = headers.get(machineAuthHeaders.idempotencyKey)
  if (idempotencyKey !== null && !/^[A-Za-z0-9._:-]{1,512}$/.test(idempotencyKey)) throw unauthorized()
  const method = request.method.toUpperCase()
  if (!['GET', 'HEAD'].includes(method) && !idempotencyKey) throw new MachineAuthError(400, 'An Idempotency-Key is required')
  const signature = /^v1=([0-9a-f]{64})$/.exec(headers.get(machineAuthHeaders.signature) ?? '')?.[1]
  if (!signature) throw unauthorized()
  const bytes = await readCapped(request, options.maxBodyBytes ?? MACHINE_AUTH_MAX_BODY_BYTES)
  const canonical = canonicalRequest({ method, path: options.path, query: canonicalQuery(new URL(request.url).searchParams), principal: options.principal, timestamp, idempotencyKey, bodySha256: await sha256Hex(bytes) })
  const signatureBytes = new Uint8Array(signature.match(/../g)!.map(pair => parseInt(pair, 16)))
  // crypto.subtle.verify compares in constant time.
  if (!await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), signatureBytes, encoder.encode(canonical))) throw unauthorized()
  const body = new TextDecoder().decode(bytes)
  return {
    principal: options.principal, timestamp, idempotencyKey, body,
    json() {
      try { return JSON.parse(body) } catch { throw new MachineAuthError(400, 'Invalid JSON body') }
    },
  }
}

// Shared verbatim with projects/rawkode.studio/src/server/machine-auth.test.ts.
export const MACHINE_AUTH_TEST_VECTOR = {
  secret: 'rawkode-machine-auth-test-vector-secret-0001',
  method: 'POST',
  path: '/api/studio-handoff/adoptions',
  query: 'b=2&a=1',
  principal: 'rawkode-studio',
  timestamp: 1760000000,
  idempotencyKey: 'studio:session-1:recording-1:etag-1',
  body: '{"hello":"world"}',
  canonical: 'RAWKODE-HMAC-SHA256\nPOST\n/api/studio-handoff/adoptions\na=1&b=2\nrawkode-studio\n1760000000\nstudio:session-1:recording-1:etag-1\n93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588',
  signature: 'v1=906f15bba00b6c75688880f3836c6381ab860b505931e803ad4e4faac82811bf',
} as const

// Finds or creates the users row for a machine principal. It has role staff so
// review commands accept it, no oidcSubject so the OIDC strategy can never
// produce a session for it, and an identityKey so beforeLogin rejects it.
export async function ensureMachineActor(payload: Pick<Payload, 'find' | 'create'>, principal: MachinePrincipal) {
  const { identityKey, name, email } = machinePrincipals[principal]
  const find = async () => (await payload.find({ collection: 'users', where: { identityKey: { equals: identityKey } }, depth: 0, limit: 1, overrideAccess: true })).docs[0] as { id: number | string; role?: string } | undefined
  let user = await find()
  if (!user) {
    try {
      user = await payload.create({ collection: 'users', overrideAccess: true, context: { identityProvisioning: true }, data: { identityKey, name, role: 'staff', email, password: crypto.randomUUID() + crypto.randomUUID() } as never }) as { id: number | string; role?: string }
    } catch (error) {
      // The unique identityKey serialises concurrent first calls.
      user = await find()
      if (!user) throw error
    }
  }
  if (user.role !== 'staff') throw new MachineAuthError(503, 'Machine principal is not provisioned as staff')
  return { id: Number(user.id), collection: 'users' as const, role: 'staff' as const }
}
