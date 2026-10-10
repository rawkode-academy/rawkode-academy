import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authConfig, type AuthEnvironment, WORKER_PREVIEW_ORIGIN, WORKER_PREVIEW_CALLBACK_URI, LOOPBACK_ORIGIN, callbackUri } from '../src/auth/config'
import { PUBLIC_ORIGIN_HEADER, UntrustedOrigin } from '../src/auth/origin'
import { isStaff } from '../src/auth/access'
import { identityMapping } from '../src/auth/payload'
import { hasOidcCookie, rejectOidcMutation, rejectOidcMutationFor } from '../src/auth/csrf'
import { digest, OidcService, readCookie, type AuthUser, type Identity } from '../src/auth/oidc'
import type { AuthStore, Session, Transaction } from '../src/auth/store'
import { createCuid2 } from '../src/cuid2'
import { STRANGER_ID } from './helpers/ids'

// Generated test-only signing material; no external issuer, credentials or network.
const signingKeys = crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
const alternateKeys = crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
async function sign(claims: Record<string, unknown>, wrongKey = false) {
  const keys = await (wrongKey ? alternateKeys : signingKeys)
  const data = `${encoded({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })}.${encoded(claims)}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(data))
  return `${data}.${Buffer.from(signature).toString('base64url')}`
}

class MemoryStore implements AuthStore {
  transactions = new Map<string, Transaction>()
  sessions = new Map<string, Session>()
  async putTransaction(t: Transaction) { this.transactions.set(t.stateHash, { ...t }) }
  async consumeTransaction(stateHash: string, bindingHash: string, now: number) {
    const t = this.transactions.get(stateHash)
    if (!t || t.bindingHash !== bindingHash || t.expiresAt <= now) return null
    this.transactions.delete(stateHash) // No await between lookup/delete: atomic consume.
    return { ...t }
  }
  async putSession(s: Session) { this.sessions.set(s.tokenHash, { ...s }) }
  async getSession(hash: string, now: number) { const s = this.sessions.get(hash); return s && s.expiresAt > now ? { ...s } : null }
  async deleteSession(hash: string) { this.sessions.delete(hash) }
  async cleanup(now: number) {
    for (const [key, t] of this.transactions) if (t.expiresAt <= now) this.transactions.delete(key)
    for (const [key, s] of this.sessions) if (s.expiresAt <= now) this.sessions.delete(key)
  }
}
const ADMIN = 'https://admin.rawkode.academy', PREVIEW = 'https://preview.rawkode.academy'
const PROD: AuthEnvironment = { OIDC_DIRECT_ORIGINS: JSON.stringify([ADMIN]), OIDC_BRIDGE_ORIGINS: JSON.stringify([PREVIEW]), REVIEW_PUBLIC_MEDIA_ORIGIN: ADMIN }
// Mirrors ingress: hosted requests carry the stamped public origin; `next dev`
// loopback requests carry only the registered Host.
function at(config: ReturnType<typeof authConfig>, origin: string, input: string | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (config.local) { if (!headers.has('host')) headers.set('host', '127.0.0.1:3100') }
  else headers.set(PUBLIC_ORIGIN_HEADER, origin)
  return new Request(input, { ...init, headers })
}
type Options = {
  env?: AuthEnvironment
  origin?: string
  claims?: Record<string, unknown>
  removeClaim?: string
  wrongKey?: boolean
  userinfo?: Record<string, unknown>
  tokenError?: boolean
  discovery?: Record<string, unknown>
}
async function fixture(options: Options = {}) {
  const config = authConfig(options.env ?? {})
  const origin = options.origin ?? config.directOrigins[0]
  const redirectUri = callbackUri(origin)
  const site = (input: string | URL, init?: RequestInit) => at(config, origin, input, init)
  const store = new MemoryStore()
  let now = Math.floor(Date.now() / 1000)
  let nonce = ''
  const identities: Identity[] = []
  const ids = new Map<string, string>()
  const users = new Map<string, AuthUser>()
  const requests: { url: string; headers: Headers; body: URLSearchParams }[] = []
  const jwk = await crypto.subtle.exportKey('jwk', (await signingKeys).publicKey)
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    const headers = new Headers(init?.headers)
    requests.push({ url, headers, body: new URLSearchParams(String(init?.body ?? '')) })
    assert.equal(new URL(url).origin, config.issuer, 'All issuer traffic stays in injected fake HTTPS transport')
    if (url.endsWith('/.well-known/openid-configuration')) return Response.json({
      issuer: config.issuer, authorization_endpoint: `${config.issuer}/authorize`, token_endpoint: `${config.issuer}/token`,
      userinfo_endpoint: `${config.issuer}/userinfo`, jwks_uri: `${config.issuer}/jwks`,
      response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], ...options.discovery,
    })
    if (url.endsWith('/jwks')) return Response.json({ keys: [{ ...jwk, alg: 'RS256', use: 'sig', kid: 'test-key' }] })
    if (url.endsWith('/token')) {
      if (options.tokenError) return Response.json({ error: 'invalid_grant', error_description: 'Do not leak provider details' }, { status: 400 })
      const claims = { iss: config.issuer, sub: 'subject-one', aud: config.clientId, iat: now, exp: now + 300, nonce, ...options.claims }
      if (options.removeClaim) delete (claims as Record<string, unknown>)[options.removeClaim]
      return Response.json({ access_token: 'test-only-provider-access-token', token_type: 'Bearer', expires_in: 1800, id_token: await sign(claims, options.wrongKey) })
    }
    if (url.endsWith('/userinfo')) return Response.json({ sub: 'subject-one', name: 'Test Person', email: 'shared@example.invalid', email_verified: true, ...options.userinfo })
    throw new Error(`Unexpected fake issuer request: ${url}`)
  }) as typeof fetch
  const mapping = {
    async map(identity: Identity) {
      identities.push({ ...identity })
      const key = `${identity.issuer}\0${identity.subject}`
      let id = ids.get(key)
      if (!id) { id = `u${String(ids.size + 1).padStart(23, '0')}`; ids.set(key, id) }
      users.set(id, { id, collection: 'users', role: 'customer', name: identity.name, oidcIssuer: identity.issuer, oidcSubject: identity.subject })
      return id
    },
    async user(id: string) { return users.has(id) ? { ...users.get(id)! } : null },
  }
  const service = new OidcService(config, store, mapping, fetcher, () => now)
  async function begin(request = site(`${origin}/api/auth/login`)) {
    const response = await service.begin(request)
    const url = new URL(response.headers.get('location')!)
    nonce = url.searchParams.get('nonce')!
    const cookie = response.headers.get('set-cookie')!.split(';')[0]
    return { response, url, cookie, state: url.searchParams.get('state')! }
  }
  const started = await begin()
  function request(changes: Record<string, string | null> = {}, cookie = started.cookie) {
    const url = new URL(redirectUri)
    url.searchParams.set('state', started.state)
    url.searchParams.set('code', 'test-authorization-code')
    for (const [key, value] of Object.entries(changes)) value === null ? url.searchParams.delete(key) : url.searchParams.set(key, value)
    return site(url, { headers: { cookie } })
  }
  return { config, origin, redirectUri, site, store, service, mapping, identities, users, ids, requests, started, begin, request, advance: (seconds: number) => { now += seconds } }
}
function sessionHeaders(response: Response, name: string) {
  const value = response.headers.getSetCookie().find(cookie => cookie.startsWith(`${name}=`))
  assert(value, 'Session cookie must be set')
  return new Headers({ cookie: value.split(';')[0] })
}
async function rejected(response: Response) {
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'Sign-in could not be verified. Start again.' })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert(response.headers.get('set-cookie')?.includes('Max-Age=0'))
}

test('begin binds random state/nonce/PKCE S256 to hashed transaction and HttpOnly cookie', async () => {
  const f = await fixture()
  assert.equal(f.started.response.status, 302)
  const params = f.started.url.searchParams
  for (const [key, value] of Object.entries({ client_id: f.config.clientId, redirect_uri: f.redirectUri, response_type: 'code', response_mode: 'query', scope: 'openid profile email', code_challenge_method: 'S256' })) assert.equal(params.get(key), value)
  assert.match(f.started.state, /^[A-Za-z0-9_-]{32,128}$/)
  assert.notEqual(params.get('nonce'), f.started.state)
  const tx = f.store.transactions.get(await digest(f.started.state))!
  assert(tx)
  assert.equal(tx.nonce, params.get('nonce'))
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tx.verifier))
  assert.equal(params.get('code_challenge'), Buffer.from(hash).toString('base64url'))
  assert.equal(tx.bindingHash, await digest(f.started.cookie.split('=')[1]))
  assert(f.started.response.headers.get('set-cookie')?.includes('HttpOnly; SameSite=Lax'))
  assert.equal(f.started.response.headers.get('referrer-policy'), 'no-referrer')
  const second = await f.begin()
  assert.notEqual(second.state, f.started.state)
  assert.notEqual(second.cookie, f.started.cookie)
})

test('successful code exchange validates real RS256 signature, public-client PKCE and UserInfo subject', async () => {
  const f = await fixture()
  const tx = [...f.store.transactions.values()][0]
  const response = await f.service.callback(f.request())
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), '/account')
  const token = f.requests.find(r => r.url.endsWith('/token'))!
  assert.equal(token.body.get('grant_type'), 'authorization_code')
  assert.equal(token.body.get('client_id'), f.config.clientId)
  assert.equal(token.body.get('code_verifier'), tx.verifier)
  assert.equal(token.body.get('redirect_uri'), f.redirectUri)
  assert.equal(token.body.get('code'), 'test-authorization-code')
  assert.equal(token.body.has('client_secret'), false)
  assert.equal(token.headers.has('authorization'), false)
  assert.equal(f.requests.find(r => r.url.endsWith('/userinfo'))!.headers.get('authorization'), 'Bearer test-only-provider-access-token')
  assert(f.requests.some(r => r.url.endsWith('/jwks')))
  assert.deepEqual(f.identities, [{ issuer: f.config.issuer, subject: 'subject-one', name: 'Test Person', email: 'shared@example.invalid' }])
  assert.equal(f.store.transactions.size, 0)
  assert.equal(f.store.sessions.size, 1)
  const headers = sessionHeaders(response, f.config.sessionCookie)
  const browserToken = readCookie(headers, f.config.sessionCookie)!
  assert(f.store.sessions.has(await digest(browserToken)))
  assert.equal(JSON.stringify([...f.store.sessions.values()]).includes(browserToken), false)
  assert.equal(JSON.stringify([...f.store.sessions.values()]).includes('test-only-provider-access-token'), false)
  const session = await f.service.session(headers)
  assert.equal(session?.user.role, 'customer')
  assert.equal(session?.user.oidcSubject, 'subject-one')
  assert(session!.expiresAt <= Math.floor(Date.now() / 1000) + 300)
})

for (const [name, mutate] of [
  ['missing state', (f: Awaited<ReturnType<typeof fixture>>) => f.request({ state: null })],
  ['wrong state', (f: Awaited<ReturnType<typeof fixture>>) => f.request({ state: 'x'.repeat(43) })],
  ['missing browser binding', (f: Awaited<ReturnType<typeof fixture>>) => f.request({}, '')],
  ['wrong browser binding', (f: Awaited<ReturnType<typeof fixture>>) => f.request({}, `${f.config.transactionCookie}=${'x'.repeat(43)}`)],
  ['duplicate browser binding', (f: Awaited<ReturnType<typeof fixture>>) => f.request({}, `${f.started.cookie}; ${f.started.cookie}`)],
  ['missing code', (f: Awaited<ReturnType<typeof fixture>>) => f.request({ code: null })],
  ['provider authorization error', (f: Awaited<ReturnType<typeof fixture>>) => f.request({ code: null, error: 'access_denied' })],
] as const) test(`callback rejects ${name} without mapping identity`, async () => {
  const f = await fixture()
  await rejected(await f.service.callback(mutate(f)))
  assert.equal(f.identities.length, 0)
  assert.equal(f.store.sessions.size, 0)
})

for (const key of ['state', 'code', 'error', 'iss']) test(`callback rejects duplicate ${key}`, async () => {
  const f = await fixture()
  const url = new URL(f.request().url)
  if (!url.searchParams.has(key)) url.searchParams.append(key, 'first')
  url.searchParams.append(key, 'duplicate')
  await rejected(await f.service.callback(f.site(url, { headers: { cookie: f.started.cookie } })))
  assert.equal(f.requests.some(r => r.url.endsWith('/token')), false)
})

test('transaction expires at TTL and cannot mint a session', async () => {
  const f = await fixture()
  f.advance(f.config.transactionTTL)
  await rejected(await f.service.callback(f.request()))
  assert.equal(f.requests.some(r => r.url.endsWith('/token')), false)
})
test('atomic transaction consumption permits only one concurrent callback and prevents replay', async () => {
  const f = await fixture()
  const results = await Promise.all([f.service.callback(f.request()), f.service.callback(f.request())])
  assert.deepEqual(results.map(r => r.status).sort(), [303, 400])
  await rejected(await f.service.callback(f.request()))
  assert.equal(f.requests.filter(r => r.url.endsWith('/token')).length, 1)
  assert.equal(f.identities.length, 1)
})

for (const [name, options] of [
  ['wrong nonce', { claims: { nonce: 'wrong' } }],
  ['missing nonce', { removeClaim: 'nonce' }],
  ['wrong issuer', { claims: { iss: 'https://other.example.invalid' } }],
  ['wrong audience', { claims: { aud: 'different-client' } }],
  ['wrong authorized party', { claims: { azp: 'different-client' } }],
  ['wrong signature', { wrongKey: true }],
  ['expired ID token', { claims: { exp: Math.floor(Date.now() / 1000) - 60 } }],
  ['future issued-at claim', { claims: { iat: Math.floor(Date.now() / 1000) + 3600 } }],
  ['missing subject', { removeClaim: 'sub' }],
  ['mismatched UserInfo subject', { userinfo: { sub: 'other-subject' } }],
  ['token endpoint error', { tokenError: true }],
] satisfies [string, Options][]) test(`callback rejects ${name} with generic error and no identity mapping`, async () => {
  const f = await fixture(options)
  await rejected(await f.service.callback(f.request()))
  assert.equal(f.identities.length, 0)
  assert.equal(f.store.sessions.size, 0)
  assert.equal(f.store.transactions.size, 0)
})

test('unverified email is not forwarded to the identity mapper', async () => {
  const f = await fixture({ userinfo: { email_verified: false } })
  assert.equal((await f.service.callback(f.request())).status, 303)
  assert.equal(f.identities[0].email, undefined)
  assert.equal(f.identities[0].subject, 'subject-one')
})
test('production identity mapper keys by issuer+subject, never links by email, and updates profile metadata', async () => {
  const config = authConfig({ OIDC_STAFF_SUBJECTS: '["one"]' })
  const localAccountID = STRANGER_ID
  const records: Record<string, any>[] = [{ id: localAccountID, email: 'same@example.invalid', role: 'staff' }]
  const queries: any[] = []
  const payload = {
    async find(args: any) { queries.push(args); return { docs: records.filter(record => record.identityKey === args.where.identityKey.equals) } },
    async create(args: any) { assert.equal(args.context.identityProvisioning, true); const doc = { ...args.data, id: createCuid2() }; records.push(doc); return doc },
    async update(args: any) { assert.equal(args.context.identityProvisioning, true); Object.assign(records.find(record => record.id === args.id)!, args.data) },
    async findByID(args: any) { return records.find(record => record.id === args.id) },
  }
  const mapping = identityMapping(payload as never, config)
  const first = await mapping.map({ issuer: config.issuer, subject: 'one', email: 'same@example.invalid' })
  const second = await mapping.map({ issuer: config.issuer, subject: 'two', email: 'same@example.invalid' })
  assert.notEqual(first, second)
  assert.notEqual(first, localAccountID, 'Must not attach an existing local account by matching email')
  assert.notEqual(second, localAccountID)
  assert.equal(await mapping.map({ issuer: config.issuer, subject: 'one', email: 'changed@example.invalid', name: 'Changed name' }), first)
  assert.equal(records.find(record => record.id === first)?.profileEmail, 'changed@example.invalid')
  assert.equal(records.find(record => record.id === first)?.role, 'staff')
  assert.equal(records.find(record => record.id === second)?.role, 'customer')
  assert(queries.every(query => Object.keys(query.where).join() === 'identityKey'))
  assert(records.filter(record => record.id !== localAccountID).every(record => record.email.endsWith('@oidc.invalid')))
  assert.equal((await mapping.user(first))?.oidcSubject, 'one')
  assert.equal(await mapping.user(createCuid2()), null)
})
test('identity mapper recovers a concurrent unique identity insertion without email fallback', async () => {
  const config = authConfig({})
  let winner: Record<string, unknown> | null = null
  const mapping = identityMapping({
    async find(args: any) { assert(args.where.identityKey); return { docs: winner ? [winner] : [] } },
    async create(args: any) { winner = { ...args.data, id: STRANGER_ID }; throw new Error('Simulated unique constraint race') },
  } as never, config)
  assert.equal(await mapping.map({ issuer: config.issuer, subject: 'raced-subject', email: 'same@example.invalid' }), STRANGER_ID)
})
test('opaque session expires, respects account deletion, and revokes immediately', async () => {
  const f = await fixture()
  const headers = sessionHeaders(await f.service.callback(f.request()), f.config.sessionCookie)
  assert(await f.service.session(headers))
  const userId = [...f.users.keys()][0]!
  const user = f.users.get(userId)!
  f.users.delete(userId)
  assert.equal(await f.service.session(headers), null)
  f.users.set(userId, user)
  const hash = await digest(readCookie(headers, f.config.sessionCookie)!)
  await f.store.deleteSession(hash)
  assert.equal(await f.service.session(headers), null)
  await f.store.putSession({ tokenHash: hash, userId, expiresAt: Math.floor(Date.now() / 1000) + 60 })
  f.advance(61)
  assert.equal(await f.service.session(headers), null)
})
test('new successful sign-in rotates and invalidates the previous opaque session', async () => {
  const f = await fixture()
  const oldHeaders = sessionHeaders(await f.service.callback(f.request()), f.config.sessionCookie)
  const next = await f.begin()
  const url = new URL(f.redirectUri)
  url.searchParams.set('state', next.state); url.searchParams.set('code', 'second-code')
  const response = await f.service.callback(f.site(url, { headers: { cookie: `${next.cookie}; ${oldHeaders.get('cookie')}` } }))
  assert.equal(response.status, 303)
  assert.equal(await f.service.session(oldHeaders), null)
  assert(await f.service.session(sessionHeaders(response, f.config.sessionCookie)))
  assert.equal(f.store.sessions.size, 1)
})
test('customer is default; staff privileges require exact subject allowlist and are recalculated', async () => {
  const f = await fixture({ env: { OIDC_STAFF_SUBJECTS: '["subject-one"]' } })
  const headers = sessionHeaders(await f.service.callback(f.request()), f.config.sessionCookie)
  assert.equal((await f.service.session(headers))?.user.role, 'staff')
  f.config.staffSubjects.length = 0
  assert.equal((await f.service.session(headers))?.user.role, 'customer')
  assert(isStaff({ collection: 'users', role: 'staff' }))
  for (const value of [null, {}, { collection: 'users' }, { collection: 'users', role: 'customer' }, { collection: 'other', role: 'staff' }]) assert.equal(isStaff(value), false)
})
test('logout requires matching Origin and revokes session with no-store response', async () => {
  const f = await fixture()
  const headers = sessionHeaders(await f.service.callback(f.request()), f.config.sessionCookie)
  const cookie = headers.get('cookie')!
  for (const origin of ['', 'https://untrusted.example.invalid']) {
    assert.equal((await f.service.logout(f.site(`${f.origin}/api/auth/logout`, { method: 'POST', headers: { cookie, origin } }))).status, 403)
    assert(await f.service.session(headers))
  }
  const response = await f.service.logout(f.site(`${f.origin}/api/auth/logout`, { method: 'POST', headers: { cookie, origin: f.origin } }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert(response.headers.get('set-cookie')?.includes('Max-Age=0'))
  assert.equal(await f.service.session(headers), null)
})
test('begin and callback reject untrusted application origins and callback paths', async () => {
  const f = await fixture()
  await assert.rejects(f.service.begin(new Request('https://evil.example.invalid/api/auth/login')))
  await rejected(await f.service.callback(new Request(f.request().url.replace(f.origin, 'https://evil.example.invalid'), { headers: { cookie: f.started.cookie } })))
  await rejected(await f.service.callback(f.site(f.request().url.replace('/api/auth/callback', '/wrong'), { headers: { cookie: f.started.cookie } })))
})
test('discovery rejects cross-origin provider endpoints and lack of S256', async () => {
  await assert.rejects(fixture({ discovery: { token_endpoint: 'https://evil.example.invalid/token' } }), /Untrusted provider endpoint/)
  await assert.rejects(fixture({ discovery: { code_challenge_methods_supported: ['plain'] } }), /PKCE S256 required/)
})
test('production cookies use __Host prefix, Secure and fixed host-only path on both hosts', async () => {
  for (const origin of [ADMIN, PREVIEW]) {
    const f = await fixture({ env: PROD, origin })
    const response = await f.service.callback(f.request())
    assert.equal(response.status, 303)
    for (const value of [...f.started.response.headers.getSetCookie(), ...response.headers.getSetCookie()]) { assert(value.startsWith('__Host-')); assert(value.includes('Path=/')); assert(value.includes('; Secure')); assert(!value.includes('Domain=')) }
  }
})
test('configuration rejects unexpected issuer/client/callback, unsafe local fallback and invalid limits', () => {
  for (const env of [
    { OIDC_ISSUER: 'https://evil.example.invalid' }, { OIDC_CLIENT_ID: 'other' },
    { OIDC_DIRECT_ORIGINS: '["https://preview.rawkode.academy.evil.invalid"]' },
    { OIDC_DIRECT_ORIGINS: '["https://admin.rawkode.academy/"]' },
    { OIDC_DIRECT_ORIGINS: '["https://admin.rawkode.academy/api/auth/callback"]' },
    { OIDC_DIRECT_ORIGINS: '["https://admin.rawkode.academy","https://admin.rawkode.academy"]' },
    { OIDC_DIRECT_ORIGINS: '["https://admin.rawkode.academy"]', OIDC_BRIDGE_ORIGINS: '["https://admin.rawkode.academy"]' },
    { OIDC_DIRECT_ORIGINS: '["http://127.0.0.1:3100","https://admin.rawkode.academy"]' },
    { OIDC_DIRECT_ORIGINS: '["http://127.0.0.1:3100"]', OIDC_BRIDGE_ORIGINS: '["https://preview.rawkode.academy"]' },
    { OIDC_DIRECT_ORIGINS: '[]' },
    { OIDC_DIRECT_ORIGINS: '["https://admin.rawkode.academy"]', OIDC_BRIDGE_ORIGINS: '["http://127.0.0.1:3100"]' },
    { ...PROD, POC_DEV_LOCAL_AUTH: 'true' },
    { ...PROD, REVIEW_PUBLIC_MEDIA_ORIGIN: PREVIEW },
    { OIDC_DIRECT_ORIGINS: '"https://admin.rawkode.academy"' }, { OIDC_BRIDGE_ORIGINS: '{}' }, { OIDC_DIRECT_ORIGINS: 'not json' },
    { OIDC_SESSION_TTL_SECONDS: '0' }, { OIDC_SESSION_TTL_SECONDS: '3601' }, { OIDC_SESSION_TTL_SECONDS: '1.5' }, { OIDC_SESSION_TTL_SECONDS: 'NaN' },
    { OIDC_STAFF_SUBJECTS: '"everyone"' }, { OIDC_STAFF_SUBJECTS: '[""]' }, { OIDC_STAFF_SUBJECTS: '[1]' },
  ]) assert.throws(() => authConfig(env))
  assert.equal(authConfig({}).localAuth, false)
  assert.equal(authConfig({ POC_DEV_LOCAL_AUTH: 'true' }).localAuth, true)
  assert.equal(authConfig(PROD).localAuth, false)
  assert.deepEqual(authConfig(PROD).origins, [ADMIN, PREVIEW])
  assert.equal(authConfig(PROD).publicMediaOrigin, ADMIN)
  assert.equal(authConfig({}).publicMediaOrigin, LOOPBACK_ORIGIN)
  assert.equal(authConfig({ OIDC_DIRECT_ORIGINS: JSON.stringify([WORKER_PREVIEW_ORIGIN]) }).publicMediaOrigin, WORKER_PREVIEW_ORIGIN)
  assert.equal(callbackUri(WORKER_PREVIEW_ORIGIN), WORKER_PREVIEW_CALLBACK_URI)
})

test('Next internal localhost spelling with registered loopback Host preserves exact authorization and token redirects', async () => {
  const f = await fixture()
  const started = await f.begin(new Request('http://localhost:3100/api/auth/login', { headers: { host: '127.0.0.1:3100' } }))
  assert.equal(started.response.status, 302)
  assert.equal(started.url.searchParams.get('redirect_uri'), f.redirectUri)
  assert.equal(f.store.transactions.get(await digest(started.state))?.redirectUri, f.redirectUri)
  const url = new URL('http://localhost:3100/api/auth/callback')
  url.searchParams.set('state', started.state)
  url.searchParams.set('code', 'internal-normalized-callback-code')
  const response = await f.service.callback(new Request(url, { headers: { host: '127.0.0.1:3100', cookie: started.cookie } }))
  assert.equal(response.status, 303)
  assert.equal(f.requests.find(r => r.url.endsWith('/token'))?.body.get('redirect_uri'), 'http://127.0.0.1:3100/api/auth/callback')
  assert(await f.service.session(sessionHeaders(response, f.config.sessionCookie)))
})

for (const [origin, host] of [
  ['http://localhost:3100', 'localhost:3100'],
  ['http://localhost:3100', 'evil.example.invalid'],
  ['http://localhost:3100', '127.0.0.1:3101'],
  ['http://localhost:3100', ''],
  ['http://localhost:3101', '127.0.0.1:3100'],
  ['https://localhost:3100', '127.0.0.1:3100'],
  ['http://127.0.0.2:3100', '127.0.0.1:3100'],
  ['https://external.example.invalid', '127.0.0.1:3100'],
]) test(`normalization rejects origin ${origin} with Host ${host || '(missing)'}`, async () => {
  const f = await fixture()
  const headers = { host, 'x-forwarded-host': '127.0.0.1:3100', 'x-forwarded-proto': 'http' }
  await assert.rejects(f.service.begin(new Request(`${origin}/api/auth/login`, { headers })), /Untrusted application origin/)
  const callback = new URL(f.request().url)
  const url = new URL(`${origin}${callback.pathname}${callback.search}`)
  await rejected(await f.service.callback(new Request(url, { headers: { ...headers, cookie: f.started.cookie } })))
  assert.equal(f.requests.some(r => r.url.endsWith('/token')), false)
})

test('production configuration never accepts internal localhost spelling or a loopback Host exception', async () => {
  const f = await fixture({ env: PROD, origin: PREVIEW })
  const headers = { host: '127.0.0.1:3100', cookie: f.started.cookie }
  await assert.rejects(f.service.begin(new Request('http://localhost:3100/api/auth/login', { headers })))
  await rejected(await f.service.callback(new Request(f.request().url.replace(f.origin, 'http://localhost:3100'), { headers })))
})

test('normalized loopback callback still rejects any path other than the exact registered callback', async () => {
  const f = await fixture()
  const callback = f.request().url.replace(f.origin, 'http://localhost:3100').replace('/api/auth/callback', '/api/auth/other')
  await rejected(await f.service.callback(new Request(callback, { headers: { host: '127.0.0.1:3100', cookie: f.started.cookie } })))
  assert.equal(f.requests.some(r => r.url.endsWith('/token')), false)
})

for (const cookie of [
  'poc-oidc-session=test', '__Host-poc-oidc-session=test',
  'another=value; poc-oidc-session=test', 'another=value; __Host-poc-oidc-session=test',
  'another=value;poc-oidc-session=test',
]) test(`CSRF guard recognizes OIDC cookie placement ${cookie.split('=test')[0]}`, () => {
  const origin = 'https://preview.rawkode.academy'
  assert.equal(hasOidcCookie(new Headers({ cookie })), true)
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const suppliedOrigin of ['', 'https://external.example.invalid', 'https://preview.rawkode.academy.external.invalid', 'null']) {
      const headers = { cookie, ...(suppliedOrigin ? { origin: suppliedOrigin } : {}) }
      assert.equal(rejectOidcMutation(new Request(`${origin}/api/videos`, { method, headers }), origin), true)
    }
    assert.equal(rejectOidcMutation(new Request(`${origin}/api/videos`, { method, headers: { cookie, origin } }), origin), false)
  }
})

test('CSRF guard leaves safe methods and requests without an OIDC session cookie unblocked', () => {
  const origin = 'https://preview.rawkode.academy'
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(rejectOidcMutation(new Request(`${origin}/api/videos`, { method, headers: { cookie: '__Host-poc-oidc-session=test' } }), origin), false)
  for (const cookie of ['', 'unrelated=value', 'prefix-poc-oidc-session=test', 'poc-oidc-session-other=test']) {
    assert.equal(hasOidcCookie(new Headers({ cookie })), false)
    assert.equal(rejectOidcMutation(new Request(`${origin}/api/videos`, { method: 'POST', headers: { cookie } }), origin), false)
  }
})

test('null origin rejects every cookie-bearing mutation and leaves cookieless requests alone', () => {
  const url = 'https://pr-feature-rawkode-academy-payload.rawkodeacademy.workers.dev/api/videos'
  for (const origin of ['', 'null', ADMIN]) assert.equal(rejectOidcMutationFor(new Request(url, { method: 'POST', headers: { cookie: '__Host-poc-oidc-session=test', ...(origin ? { origin } : {}) } }), null), true)
  assert.equal(rejectOidcMutationFor(new Request(url, { method: 'POST', headers: { authorization: 'Bearer pipeline' } }), null), false)
  assert.equal(rejectOidcMutationFor(new Request(url, { method: 'GET', headers: { cookie: '__Host-poc-oidc-session=test' } }), null), false)
  assert.equal(rejectOidcMutationFor(new Request(url, { method: 'POST', headers: { cookie: '__Host-poc-oidc-session=test', origin: ADMIN } }), ADMIN), false)
})

test('begin sends and stores the redirect URI of the host it runs on', async () => {
  for (const origin of [ADMIN, PREVIEW]) {
    const f = await fixture({ env: PROD, origin })
    assert.equal(f.started.url.searchParams.get('redirect_uri'), `${origin}/api/auth/callback`)
    assert.equal(f.store.transactions.get(await digest(f.started.state))?.redirectUri, `${origin}/api/auth/callback`)
  }
})

test('a login begun on admin cannot be completed on preview', async () => {
  const f = await fixture({ env: PROD, origin: ADMIN })
  const url = new URL(f.request().url.replace(ADMIN, PREVIEW))
  const response = await f.service.callback(at(f.config, PREVIEW, url, { headers: { cookie: f.started.cookie } }))
  await rejected(response)
  assert.equal(f.requests.some(r => r.url.endsWith('/token')), false)
  assert.equal(f.store.transactions.size, 0, 'The transaction is consumed: single use')
  assert.equal(f.identities.length, 0)
})

test('begin rejects unlisted, unconfigured and unstamped hosted origins', async () => {
  const f = await fixture({ env: PROD })
  for (const origin of ['https://evil.example.invalid', WORKER_PREVIEW_ORIGIN, LOOPBACK_ORIGIN]) {
    await assert.rejects(f.service.begin(new Request(`${origin}/api/auth/login`, { headers: { [PUBLIC_ORIGIN_HEADER]: origin } })), UntrustedOrigin)
  }
  await assert.rejects(f.service.begin(new Request(`${ADMIN}/api/auth/login`)), UntrustedOrigin)
  await assert.rejects(f.service.begin(new Request(`${ADMIN}/api/auth/login`, { headers: { host: '127.0.0.1:3100' } })), UntrustedOrigin)
})

test('logout is bound to its own host and never throws for an untrusted host', async () => {
  const f = await fixture({ env: PROD, origin: PREVIEW })
  const headers = sessionHeaders(await f.service.callback(f.request()), f.config.sessionCookie)
  const cookie = headers.get('cookie')!
  assert.equal((await f.service.logout(f.site(`${PREVIEW}/api/auth/logout`, { method: 'POST', headers: { cookie, origin: ADMIN } }))).status, 403)
  const untrusted = await f.service.logout(new Request(`${PREVIEW}/api/auth/logout`, { method: 'POST', headers: { cookie, origin: PREVIEW, [PUBLIC_ORIGIN_HEADER]: 'https://evil.example.invalid' } }))
  assert.equal(untrusted.status, 403)
  assert.equal(untrusted.headers.get('cache-control'), 'no-store')
  assert(await f.service.session(headers))
  assert.equal((await f.service.logout(f.site(`${PREVIEW}/api/auth/logout`, { method: 'POST', headers: { cookie, origin: PREVIEW } }))).status, 200)
})
