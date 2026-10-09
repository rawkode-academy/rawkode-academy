import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authConfig, LOOPBACK_ORIGIN, WORKER_PREVIEW_ORIGIN, type AuthEnvironment } from '../src/auth/config'
import { PUBLIC_ORIGIN_HEADER, requestOrigin } from '../src/auth/origin'
import { usersCollection } from '../src/auth/payload'
import { REVIEW_BRIDGE_ROUTES, serveBridge, serveDirect } from '../src/ingress'
import { reviewRequestActor } from '../src/review/host'
import { ReviewError } from '../src/review/contracts'
import { reviewRoutes } from '../../website/review/bridge'

const ADMIN = 'https://admin.rawkode.academy', PREVIEW = 'https://preview.rawkode.academy'
const PROD: AuthEnvironment = { OIDC_DIRECT_ORIGINS: JSON.stringify([ADMIN]), OIDC_BRIDGE_ORIGINS: JSON.stringify([PREVIEW]), REVIEW_PUBLIC_MEDIA_ORIGIN: ADMIN }
const prod = authConfig(PROD)
const local = authConfig({})
const cookie = '__Host-poc-oidc-session=opaque'

function downstream() {
  const seen: Request[] = []
  const next = async (request: Request) => { seen.push(request); return new Response('downstream') }
  return { seen, next }
}
const stamped = (request: Request) => request.headers.get(PUBLIC_ORIGIN_HEADER)

test('direct: the request URL decides the host, never a client-sent header', async () => {
  const { seen, next } = downstream()
  await serveDirect(new Request(`${ADMIN}/admin`, { headers: { [PUBLIC_ORIGIN_HEADER]: PREVIEW } }), prod, next)
  assert.equal(stamped(seen[0]), ADMIN)
  assert.equal(requestOrigin(seen[0].headers, prod), ADMIN)
})

test('direct: unlisted hosts are served unstamped, never 421', async () => {
  for (const [url, init] of [
    [`${PREVIEW}/api/review`, { headers: { [PUBLIC_ORIGIN_HEADER]: PREVIEW } }],
    ['https://pr-feature-x-rawkode-academy-payload.rawkodeacademy.workers.dev/admin', {}],
    ['https://pipeline.internal/api/poc/pipeline/callback', { method: 'POST', headers: { authorization: 'Bearer pipeline-secret', 'content-type': 'application/json' }, body: '{}' }],
  ] as [string, RequestInit][]) {
    const { seen, next } = downstream()
    const response = await serveDirect(new Request(url, init), prod, next)
    assert.equal(response.status, 200, url)
    assert.equal(seen.length, 1)
    assert.equal(stamped(seen[0]), null, url)
    assert.equal(requestOrigin(seen[0].headers, prod), null)
    assert.equal(seen[0].headers.get('authorization'), (init.headers as Record<string, string> | undefined)?.authorization ?? null)
    if (init.body) assert.equal(await seen[0].text(), '{}')
  }
})

test('direct: cookie-bearing mutations need the validated origin', async () => {
  const { seen, next } = downstream()
  const unlisted = await serveDirect(new Request('https://pr-feature-x-rawkode-academy-payload.rawkodeacademy.workers.dev/api/videos', { method: 'POST', headers: { cookie, origin: 'https://pr-feature-x-rawkode-academy-payload.rawkodeacademy.workers.dev' } }), prod, next)
  assert.equal(unlisted.status, 403)
  const crossHost = await serveDirect(new Request(`${ADMIN}/api/videos`, { method: 'POST', headers: { cookie, origin: PREVIEW } }), prod, next)
  assert.equal(crossHost.status, 403)
  assert.deepEqual(await crossHost.json(), { error: 'Untrusted request origin' })
  assert.equal(seen.length, 0)
  assert.equal((await serveDirect(new Request(`${ADMIN}/api/videos`, { method: 'POST', headers: { cookie, origin: ADMIN } }), prod, next)).status, 200)
})

// wrangler dev drains only an unused inbound body; a 403 that moved it into a wrapper left it
// unread and intermittently broke the next request (500 "Network connection lost").
test('ingress rejections answer the original request without consuming or moving its body', async () => {
  const { seen, next } = downstream()
  const post = (url: string, origin: string) => new Request(url, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: '{}' })
  for (const [request, serve, config] of [
    [post(`${LOOPBACK_ORIGIN}/api/auth/logout`, 'https://attacker.invalid'), serveDirect, local],
    [post(`${ADMIN}/api/videos`, PREVIEW), serveDirect, prod],
    [post(`${PREVIEW}/api/auth/logout`, ADMIN), serveBridge, prod],
  ] as const) {
    assert.equal((await serve(request, config, next)).status, 403, request.url)
    assert.equal(request.bodyUsed, false, request.url)
    assert.equal(await request.text(), '{}')
  }
  assert.equal(seen.length, 0)
})

test('direct: root GraphQL rewrite keeps the stamped origin', async () => {
  const { seen, next } = downstream()
  await serveDirect(new Request(`${ADMIN}/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"query":"{__typename}"}' }), prod, next)
  await serveDirect(new Request(`${ADMIN}/?query=%7B__typename%7D`), prod, next)
  await serveDirect(new Request(`${ADMIN}/`), prod, next)
  assert.deepEqual(seen.map(request => new URL(request.url).pathname), ['/graphql', '/graphql', '/'])
  assert.equal(stamped(seen[0]), ADMIN)
  assert.equal(await seen[0].text(), '{"query":"{__typename}"}')
})

test('direct: local config stamps the loopback origin', async () => {
  const { seen, next } = downstream()
  await serveDirect(new Request(`${LOOPBACK_ORIGIN}/api/auth/session`), local, next)
  assert.equal(stamped(seen[0]), LOOPBACK_ORIGIN)
  assert.equal(requestOrigin(seen[0].headers, local), LOOPBACK_ORIGIN)
})

test('bridge: hard gate on origin, route table and method', async () => {
  const { seen, next } = downstream()
  const misdirected = await serveBridge(new Request(`${ADMIN}/api/review`), prod, next)
  assert.equal(misdirected.status, 421)
  assert.equal(misdirected.headers.get('cache-control'), 'no-store')
  for (const path of ['/admin', '/api/graphql', '/api/users', '/graphql', '/']) assert.equal((await serveBridge(new Request(PREVIEW + path), prod, next)).status, 404, path)
  assert.equal((await serveBridge(new Request(`${PREVIEW}/api/review`, { method: 'DELETE' }), prod, next)).status, 405)
  assert.equal((await serveBridge(new Request(`${PREVIEW}/api/review`, { method: 'POST', headers: { cookie, origin: ADMIN } }), prod, next)).status, 403)
  assert.equal((await serveBridge(new Request(`${PREVIEW}/api/review`), local, next)).status, 421)
  assert.equal(seen.length, 0)
})

test('bridge: a valid preview request is stamped as preview', async () => {
  const { seen, next } = downstream()
  const response = await serveBridge(new Request(`${PREVIEW}/api/review`, { method: 'POST', headers: { cookie, origin: PREVIEW, [PUBLIC_ORIGIN_HEADER]: ADMIN }, body: '{}' }), prod, next)
  assert.equal(response.status, 200)
  assert.equal(stamped(seen[0]), PREVIEW)
  assert.equal(requestOrigin(seen[0].headers, prod), PREVIEW)
  assert.equal(await seen[0].text(), '{}')
})

test('requestOrigin trusts only configured stamped origins', () => {
  assert.equal(requestOrigin(new Headers({ [PUBLIC_ORIGIN_HEADER]: 'https://evil.example.invalid' }), prod), null)
  assert.equal(requestOrigin(new Headers({ [PUBLIC_ORIGIN_HEADER]: LOOPBACK_ORIGIN }), prod), null)
  assert.equal(requestOrigin(new Headers({ host: '127.0.0.1:3100' }), prod), null)
  assert.equal(requestOrigin(new Headers({ host: '127.0.0.1:3100' }), local), LOOPBACK_ORIGIN)
  assert.equal(requestOrigin(new Headers({ host: 'localhost:3100' }), local), null)
})

test('Payload strategy returns no user for an untrusted or mismatched origin', async () => {
  const authenticate = usersCollection(prod, {} as D1Database).auth
  assert(typeof authenticate === 'object' && authenticate.strategies)
  const strategy = authenticate.strategies[0]
  const payload = {} as never
  for (const headers of [
    new Headers({ cookie }),
    new Headers({ cookie, [PUBLIC_ORIGIN_HEADER]: 'https://evil.example.invalid' }),
    new Headers({ cookie, [PUBLIC_ORIGIN_HEADER]: ADMIN, origin: PREVIEW }),
  ]) assert.deepEqual(await strategy.authenticate({ headers, payload } as never), { user: null })
})

test('review API on a direct origin is staff only when a bridge exists; customers use the bridge', () => {
  const staff = { id: 1, collection: 'users', role: 'staff' }
  const customer = { id: 2, collection: 'users', role: 'customer' }
  const at = (origin: string) => new Headers({ [PUBLIC_ORIGIN_HEADER]: origin })
  const status = (fn: () => unknown) => { try { fn(); return 200 } catch (error) { assert(error instanceof ReviewError); return error.status } }
  assert.deepEqual(reviewRequestActor(at(ADMIN), prod, staff), { origin: ADMIN, actor: staff })
  assert.equal(status(() => reviewRequestActor(at(ADMIN), prod, customer)), 404)
  assert.equal(status(() => reviewRequestActor(at(ADMIN), prod, null)), 404)
  assert.deepEqual(reviewRequestActor(at(PREVIEW), prod, customer), { origin: PREVIEW, actor: customer })
  assert.equal(status(() => reviewRequestActor(at(PREVIEW), prod, null)), 401)
  assert.equal(status(() => reviewRequestActor(new Headers(), prod, staff)), 403)
  assert.equal(status(() => reviewRequestActor(at('https://evil.example.invalid'), prod, staff)), 403)
  assert.deepEqual(reviewRequestActor(new Headers({ host: '127.0.0.1:3100' }), local, customer), { origin: LOOPBACK_ORIGIN, actor: customer })
  const prLocal = authConfig({ OIDC_DIRECT_ORIGINS: JSON.stringify([WORKER_PREVIEW_ORIGIN]), OIDC_BRIDGE_ORIGINS: '[]' })
  assert.deepEqual(reviewRequestActor(at(WORKER_PREVIEW_ORIGIN), prLocal, customer), { origin: WORKER_PREVIEW_ORIGIN, actor: customer })
})

test('ingress route table matches the website bridge route table', () => {
  assert.deepEqual(REVIEW_BRIDGE_ROUTES, reviewRoutes)
})
