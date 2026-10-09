import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { authConfig, WORKER_PREVIEW_ORIGIN } from '../src/auth/config'

// scripts/migrate-production.ts reads wrangler.jsonc with JSON.parse, so both
// configs must stay comment-free JSON.
type Config = { vars: Record<string, string>; previews: { vars: Record<string, string> }; services?: unknown; secrets_store_secrets?: unknown }
const read = (file: string) => ({ text: readFileSync(file, 'utf8'), config: JSON.parse(readFileSync(file, 'utf8')) as Config })
const main = read('wrangler.jsonc')
const runtime = read('wrangler.preview-runtime.jsonc')
const originVars = (vars: Record<string, string>) => Object.fromEntries(['OIDC_DIRECT_ORIGINS', 'OIDC_BRIDGE_ORIGINS', 'REVIEW_PUBLIC_MEDIA_ORIGIN'].map(key => [key, vars[key]]))

test('production vars serve admin directly and preview through ReviewBridge', () => {
  const config = authConfig(main.config.vars)
  assert.deepEqual(config.directOrigins, ['https://admin.rawkode.academy'])
  assert.deepEqual(config.bridgeOrigins, ['https://preview.rawkode.academy'])
  assert.equal(config.publicMediaOrigin, 'https://admin.rawkode.academy')
  assert.equal(config.local, false)
  assert.equal(config.localAuth, false)
})

test('Worker Preview and review-runtime vars validate and agree', () => {
  for (const vars of [main.config.previews.vars, runtime.config.vars]) {
    const config = authConfig(vars)
    assert.deepEqual(config.directOrigins, [WORKER_PREVIEW_ORIGIN])
    assert.deepEqual(config.bridgeOrigins, [])
    assert.equal(config.publicMediaOrigin, WORKER_PREVIEW_ORIGIN)
  }
  assert.deepEqual(originVars(main.config.previews.vars), originVars(runtime.config.vars))
})

test('migrate-production config (vars only, no secrets or services) still loads auth config', () => {
  // Mirrors scripts/migrate-production.ts: only d1_databases, r2_buckets and vars are
  // copied, and .dev.vars may be absent in CI, so authConfig must need no secret.
  assert.doesNotThrow(() => authConfig({ ...main.config.vars }))
})

test('single-origin configuration and the separate review backend are gone', () => {
  for (const { text } of [main, runtime]) assert.equal(text.includes('OIDC_REDIRECT_URI'), false)
  assert.equal(existsSync('wrangler.review.jsonc'), false)
})
