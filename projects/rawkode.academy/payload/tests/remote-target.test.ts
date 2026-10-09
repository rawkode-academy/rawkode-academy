import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { assertProductionImportAllowed, assertSequenceAdvances, KLUSTERED_PRODUCTION_CONFIRMATION, parseImportTarget, positionalArguments, PRODUCTION_CONFIRMATION, type ProductionGateInput } from '../scripts/lib/import-target'
import { assertRemoteTargetConfig, buildRemoteTargetConfig, CONTENT_CDN_BUCKET, PREVIEW_RESOURCES, prepareTarget, PRODUCTION_RESOURCES, TargetError, type SourceWranglerConfig } from '../scripts/lib/remote-target'
import { isLoopbackRequest } from '../src/local-request'

const projectDir = process.cwd()
const wrangler = JSON.parse(readFileSync(path.join(projectDir, 'wrangler.jsonc'), 'utf8')) as SourceWranglerConfig
const rehearsalEnv = { REHEARSAL_D1_ID: '00000000-0000-4000-8000-000000000001', REHEARSAL_R2_BUCKET: 'rawkode-academy-payload-rehearsal' }

function serialised(value: unknown): string {
  return JSON.stringify(value)
}

test('production resolves the production D1 and R2 with remote bindings and no previews block', () => {
  const { config, expected } = buildRemoteTargetConfig('production', wrangler, {})
  assert.deepEqual(expected, PRODUCTION_RESOURCES)
  assert.equal('previews' in config, false)
  assert.equal(config.d1_databases.length, 1)
  assert.equal(config.r2_buckets.length, 1)
  assert.equal(config.d1_databases[0]?.database_id, '8e77ba09-dc5a-4760-99da-c7b27bf0a059')
  assert.equal(config.r2_buckets[0]?.bucket_name, 'rawkode-academy-payload')
  for (const binding of [...config.d1_databases, ...config.r2_buckets]) assert.equal(binding.remote, true)
  assert.equal(serialised(config).includes(PREVIEW_RESOURCES.databaseId), false)
  assert.equal(serialised(config).includes(PREVIEW_RESOURCES.bucketName), false)
})

test('production never resolves preview IDs, even when wrangler.jsonc is edited to point at them', () => {
  const swapped = structuredClone(wrangler)
  swapped.d1_databases = swapped.previews?.d1_databases?.map(binding => ({ ...binding, remote: false }))
  assert.throws(() => buildRemoteTargetConfig('production', swapped, {}), /database_id dffc7272/)
  const bucketSwapped = structuredClone(wrangler)
  bucketSwapped.r2_buckets = bucketSwapped.previews?.r2_buckets
  assert.throws(() => buildRemoteTargetConfig('production', bucketSwapped, {}), /bucket_name rawkode-academy-payload-preview/)
  const missing = structuredClone(wrangler)
  delete missing.d1_databases
  assert.throws(() => buildRemoteTargetConfig('production', missing, {}), /exactly one D1 binding/)
})

test('preview stays a migration-only target resolved from the previews block', () => {
  const { config } = buildRemoteTargetConfig('preview', wrangler, {})
  assert.equal(config.d1_databases[0]?.database_id, PREVIEW_RESOURCES.databaseId)
  assert.equal(config.d1_databases[0]?.remote, true)
  assert.equal(serialised(config).includes(PRODUCTION_RESOURCES.databaseId), false)
})

test('rehearsal requires explicit disposable resources and refuses shared ones', () => {
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, {}), /REHEARSAL_D1_ID and REHEARSAL_R2_BUCKET/)
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { REHEARSAL_D1_ID: rehearsalEnv.REHEARSAL_D1_ID }), /REHEARSAL_R2_BUCKET/)
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_D1_ID: PREVIEW_RESOURCES.databaseId }), /shared database/)
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_D1_ID: PRODUCTION_RESOURCES.databaseId }), /shared database/)
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_D1_NAME: PREVIEW_RESOURCES.databaseName }), /shared database/)
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_R2_BUCKET: PREVIEW_RESOURCES.bucketName }), /shared bucket/)
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_R2_BUCKET: PRODUCTION_RESOURCES.bucketName }), /shared bucket/)

  // Other spellings of a shared UUID must not pass as a different database.
  for (const shared of [PRODUCTION_RESOURCES.databaseId, PREVIEW_RESOURCES.databaseId]) {
    for (const spelling of [shared.toUpperCase(), shared.replaceAll('-', ''), shared.replaceAll('-', '').toUpperCase(), ` ${shared} `]) {
      assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_D1_ID: spelling }), /shared database/, spelling)
    }
  }
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_D1_ID: '00000000-0000-4000-8000-00000000000A' }), /lowercase hyphenated UUID/)
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_D1_ID: 'not-a-uuid' }), /lowercase hyphenated UUID/)
  // Live buckets that are not on the deny-list are caught by the naming rule.
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_R2_BUCKET: CONTENT_CDN_BUCKET }), /shared bucket/)
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_R2_BUCKET: 'rawkode-academy-videos' }), /REHEARSAL_R2_BUCKET=rawkode-academy-videos must contain "rehearsal"/)
  assert.throws(() => buildRemoteTargetConfig('rehearsal', wrangler, { ...rehearsalEnv, REHEARSAL_D1_NAME: 'rawkode-academy-platform' }), /REHEARSAL_D1_NAME=rawkode-academy-platform must contain "rehearsal"/)

  const { config, expected } = buildRemoteTargetConfig('rehearsal', wrangler, rehearsalEnv)
  assert.deepEqual(expected, { databaseId: rehearsalEnv.REHEARSAL_D1_ID, databaseName: 'rawkode-academy-payload-rehearsal', bucketName: rehearsalEnv.REHEARSAL_R2_BUCKET })
  assert.equal('previews' in config, false)
  for (const binding of [...config.d1_databases, ...config.r2_buckets]) assert.equal(binding.remote, true)
  for (const shared of [PRODUCTION_RESOURCES.databaseId, PREVIEW_RESOURCES.databaseId, PREVIEW_RESOURCES.bucketName, `"${PRODUCTION_RESOURCES.bucketName}"`]) {
    assert.equal(serialised(config).includes(shared), false, shared)
  }
})

test('the config assertion compares D1 IDs in any spelling', () => {
  const resolved = buildRemoteTargetConfig('rehearsal', wrangler, rehearsalEnv)
  for (const spelling of [PRODUCTION_RESOURCES.databaseId.toUpperCase(), PREVIEW_RESOURCES.databaseId.replaceAll('-', '')]) {
    const tampered = structuredClone(resolved)
    tampered.config.d1_databases[0]!.database_id = spelling
    tampered.expected.databaseId = spelling
    assert.throws(() => assertRemoteTargetConfig(tampered), /resolved (production|preview) resources/, spelling)
  }
  const cdn = structuredClone(resolved)
  cdn.config.r2_buckets[0]!.bucket_name = CONTENT_CDN_BUCKET
  cdn.expected.bucketName = CONTENT_CDN_BUCKET
  assert.throws(() => assertRemoteTargetConfig(cdn), /published media CDN bucket/)
  const production = buildRemoteTargetConfig('production', wrangler, {})
  production.config.d1_databases[0]!.database_id = PRODUCTION_RESOURCES.databaseId.toUpperCase()
  assert.doesNotThrow(() => assertRemoteTargetConfig(production))
})

test('prepareTarget never leaves rehearsal or production on local bindings, and local clears remote settings', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'remote-target-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await writeFile(path.join(dir, 'wrangler.jsonc'), JSON.stringify(wrangler))
  const log = () => {}

  for (const target of ['production', 'rehearsal'] as const) {
    const env: Record<string, string | undefined> = { ...rehearsalEnv }
    const prepared = prepareTarget(target, { projectDir: dir, env, log })
    assert.equal(env.POC_CLI, '1')
    assert.equal(env.POC_REMOTE_BINDINGS, '1')
    assert.equal(env.POC_CLOUDFLARE_CONFIG_PATH, prepared.configPath)
    const written = JSON.parse(readFileSync(prepared.configPath!, 'utf8'))
    assert.equal('previews' in written, false)
    assert.ok([...written.d1_databases, ...written.r2_buckets].every((binding: { remote?: boolean }) => binding.remote === true))
    if (target === 'production') assert.equal(written.d1_databases[0].database_id, PRODUCTION_RESOURCES.databaseId)
    else assert.equal(written.d1_databases[0].database_id, rehearsalEnv.REHEARSAL_D1_ID)
    prepared.cleanup()
    assert.equal(existsSync(prepared.configPath!), false)
  }

  const env: Record<string, string | undefined> = { POC_REMOTE_BINDINGS: '1', POC_CLOUDFLARE_CONFIG_PATH: '/tmp/stale.json' }
  const local = prepareTarget('local', { projectDir: dir, env, log })
  assert.equal(local.configPath, undefined)
  assert.equal(env.POC_REMOTE_BINDINGS, undefined)
  assert.equal(env.POC_CLOUDFLARE_CONFIG_PATH, undefined)
  assert.equal(env.POC_CLI, '1')

  assert.throws(() => prepareTarget('rehearsal', { projectDir: dir, env: {}, log }), TargetError)
})

test('import target parsing rejects --remote and preview', () => {
  assert.throws(() => parseImportTarget(['--remote']), /--remote is no longer supported/)
  assert.throws(() => parseImportTarget(['--target=production', '--remote']), /--remote is no longer supported/)
  for (const variant of ['--remote=true', '--remote=1', '--remote=']) assert.throws(() => parseImportTarget([variant]), /--remote is no longer supported/, variant)
  assert.equal(parseImportTarget(['--remotely-unrelated']), 'local')
  assert.throws(() => parseImportTarget(['--target=preview']), /preview D1 holds live review data/)
  assert.throws(() => parseImportTarget(['--target=staging']), /Unknown --target=staging/)
  assert.throws(() => parseImportTarget(['--target=local', '--target=production']), /once/)
  assert.equal(parseImportTarget([]), 'local')
  assert.equal(parseImportTarget(['--dry-run']), 'local')
  assert.equal(parseImportTarget(['--target=rehearsal']), 'rehearsal')
  assert.equal(parseImportTarget(['--target', 'production']), 'production')
  assert.deepEqual(positionalArguments(['--target', 'production', '--dry-run', 'export.json']), ['export.json'])
})

const gate = (overrides: Partial<ProductionGateInput> = {}): ProductionGateInput => ({
  target: 'production',
  argv: [],
  env: { CONFIRM_PRODUCTION_IMPORT: PRODUCTION_CONFIRMATION },
  gitClean: true,
  sequenceVariable: 'STATIC_CONTENT_SEQUENCE',
  watermark: { gitSha: 'abc', sequence: 1_791_222_721, sequenceSource: 'env' },
  minimumSequence: 1_791_222_721,
  ...overrides,
})

test('production imports require confirmation, a clean tree and a recorded watermark', () => {
  assert.doesNotThrow(() => assertProductionImportAllowed(gate()))
  assert.doesNotThrow(() => assertProductionImportAllowed(gate({ env: {}, argv: [`--confirm-production=${PRODUCTION_CONFIRMATION}`] })))
  assert.throws(() => assertProductionImportAllowed(gate({ env: {} })), /CONFIRM_PRODUCTION_IMPORT=rawkode-academy-payload/)
  assert.throws(() => assertProductionImportAllowed(gate({ env: { CONFIRM_PRODUCTION_IMPORT: 'yes' } })), /CONFIRM_PRODUCTION_IMPORT/)
  assert.throws(() => assertProductionImportAllowed(gate({ argv: ['--confirm-production=rawkode-academy-payload-preview'] })), /CONFIRM_PRODUCTION_IMPORT/)
  assert.throws(() => assertProductionImportAllowed(gate({ gitClean: false })), /clean git tree/)
  assert.throws(() => assertProductionImportAllowed(gate({ includeSensitive: true })), /--include-sensitive is never allowed/)
  assert.throws(() => assertProductionImportAllowed(gate({ watermark: { gitSha: 'abc', sequence: 1_791_222_721, sequenceSource: 'git' } })), /record the watermark explicitly/)
  assert.doesNotThrow(() => assertProductionImportAllowed(gate({ watermark: { gitSha: 'abc', sequence: 1_791_222_721, sequenceSource: 'snapshot' } })))
  assert.throws(() => assertProductionImportAllowed(gate({ watermark: { gitSha: 'abc', sequence: 1, sequenceSource: 'default' } })), /record the watermark explicitly with STATIC_CONTENT_SEQUENCE/)
  assert.throws(() => assertProductionImportAllowed(gate({ watermark: { gitSha: 'abc', sequence: 5, sequenceSource: 'env' } })), /older than the source watermark/)
  // Confirming the static window never confirms a Klustered production import.
  assert.throws(() => assertProductionImportAllowed(gate({ confirmation: KLUSTERED_PRODUCTION_CONFIRMATION })), /CONFIRM_PRODUCTION_KLUSTERED_IMPORT=rawkode-academy-payload-klustered/)
  assert.throws(() => assertProductionImportAllowed(gate({ confirmation: KLUSTERED_PRODUCTION_CONFIRMATION, env: {}, argv: [`--confirm-production=${PRODUCTION_CONFIRMATION}`] })), /CONFIRM_PRODUCTION_KLUSTERED_IMPORT/)
  assert.doesNotThrow(() => assertProductionImportAllowed(gate({ confirmation: KLUSTERED_PRODUCTION_CONFIRMATION, env: { CONFIRM_PRODUCTION_KLUSTERED_IMPORT: KLUSTERED_PRODUCTION_CONFIRMATION.value } })))
  assert.doesNotThrow(() => assertProductionImportAllowed(gate({ confirmation: KLUSTERED_PRODUCTION_CONFIRMATION, env: {}, argv: [`--confirm-production-klustered=${KLUSTERED_PRODUCTION_CONFIRMATION.value}`] })))
  assert.throws(() => assertProductionImportAllowed(gate({ confirmation: KLUSTERED_PRODUCTION_CONFIRMATION, env: { CONFIRM_PRODUCTION_KLUSTERED_IMPORT: KLUSTERED_PRODUCTION_CONFIRMATION.value }, includeSensitive: true })), /--include-sensitive is never allowed/)
  for (const target of ['local', 'rehearsal'] as const) {
    assert.doesNotThrow(() => assertProductionImportAllowed(gate({ target, env: {}, gitClean: false, includeSensitive: true, watermark: { gitSha: 'abc', sequence: 1, sequenceSource: 'default' } })))
  }
})

test('the sequence must move the stored watermark forward unless resuming', () => {
  assert.doesNotThrow(() => assertSequenceAdvances(10, null))
  assert.doesNotThrow(() => assertSequenceAdvances(11, 10))
  assert.throws(() => assertSequenceAdvances(9, 10), /lower than the stored watermark/)
  assert.throws(() => assertSequenceAdvances(10, 10), /--resume/)
  assert.doesNotThrow(() => assertSequenceAdvances(10, 10, { resume: true }))
})

function runScript(script: string, args: string[], env: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', script, ...args], { cwd: projectDir, encoding: 'utf8', env: { ...process.env, CONFIRM_PRODUCTION_IMPORT: '', ...env }, timeout: 60_000 })
}

test('import CLIs exit non-zero on --remote and on an unconfirmed production run before connecting', () => {
  for (const script of ['scripts/import-static.ts', 'scripts/import-klustered.ts']) {
    const remote = runScript(script, ['--remote', '--dry-run'])
    assert.notEqual(remote.status, 0, script)
    assert.match(remote.stderr, /--remote is no longer supported/, script)
  }
  const klustered = runScript('scripts/import-klustered.ts', ['--target=production', '--dry-run', 'fixtures/catalogue.json'], { CONFIRM_PRODUCTION_IMPORT: PRODUCTION_CONFIRMATION, CONFIRM_PRODUCTION_KLUSTERED_IMPORT: '' })
  assert.equal(klustered.status, 1)
  assert.match(klustered.stderr, /Refusing the production import: confirm with CONFIRM_PRODUCTION_KLUSTERED_IMPORT/)
  assert.doesNotMatch(klustered.stderr, /Target production:/)
  const reconcileProduction = runScript('scripts/reconcile-static.ts', ['--target=production'], { STATIC_CONTENT_SEQUENCE: '' })
  assert.equal(reconcileProduction.status, 1)
  assert.match(reconcileProduction.stderr, /Set STATIC_CONTENT_SEQUENCE/)
  assert.doesNotMatch(reconcileProduction.stderr, /Target production:/)
  const production = runScript('scripts/import-static.ts', ['--target=production', '--dry-run'])
  assert.equal(production.status, 1)
  assert.match(production.stderr, /Refusing the production import: confirm with CONFIRM_PRODUCTION_IMPORT/)
  assert.doesNotMatch(production.stderr, /Target production:/)
})

test('the snapshot import route is reachable only on loopback', () => {
  const request = (url: string, host: string) => new Request(url, { method: 'POST', headers: { host } })
  assert.equal(isLoopbackRequest(request('http://127.0.0.1:3100/api/poc/import', '127.0.0.1:3100')), true)
  assert.equal(isLoopbackRequest(request('http://localhost:3100/api/poc/import', '127.0.0.1:3100')), true)
  assert.equal(isLoopbackRequest(request('https://admin.rawkode.academy/api/poc/import', 'admin.rawkode.academy')), false)
  assert.equal(isLoopbackRequest(request('http://localhost:3100/api/poc/import', 'admin.rawkode.academy')), false)
  assert.equal(isLoopbackRequest(request('https://admin.rawkode.academy/api/poc/import', '127.0.0.1')), false)
  assert.equal(isLoopbackRequest(new Request('http://127.0.0.1:3100/api/poc/import')), false)
})
