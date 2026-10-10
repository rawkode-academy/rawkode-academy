import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export type RemoteTargetName = 'rehearsal' | 'preview' | 'pr-preview' | 'production'
export type TargetName = 'local' | RemoteTargetName

type Binding = Record<string, unknown> & { binding?: string }
export type SourceWranglerConfig = {
  name: string
  account_id?: string
  main: string
  compatibility_date: string
  compatibility_flags?: string[]
  d1_databases?: Binding[]
  r2_buckets?: Binding[]
  vars?: Record<string, string>
  previews?: {
    d1_databases?: Binding[]
    r2_buckets?: Binding[]
    vars?: Record<string, string>
  }
}
export type ExpectedResources = { databaseId: string; databaseName: string; bucketName: string }
export type CliWranglerConfig = {
  name: string
  account_id?: string
  main: string
  compatibility_date: string
  compatibility_flags?: string[]
  workers_dev: false
  d1_databases: Binding[]
  r2_buckets: Binding[]
  vars?: Record<string, string>
}
export type ResolvedRemoteTarget = { target: RemoteTargetName; expected: ExpectedResources; config: CliWranglerConfig }

// These IDs are deliberately duplicated from wrangler.jsonc. The wrangler file
// is the input; these constants are the independent assertion that the input
// still points where the operator believes it points.
export const PRODUCTION_RESOURCES: ExpectedResources = Object.freeze({
  databaseId: '8e77ba09-dc5a-4760-99da-c7b27bf0a059',
  databaseName: 'rawkode-academy-payload',
  bucketName: 'rawkode-academy-payload',
})
export const PREVIEW_RESOURCES: ExpectedResources = Object.freeze({
  databaseId: 'dffc7272-ef5e-4d7f-91ac-d85f504ca2ae',
  databaseName: 'rawkode-academy-payload-preview',
  bucketName: 'rawkode-academy-payload-preview',
})
export const REHEARSAL_DEFAULT_DATABASE_NAME = 'rawkode-academy-payload-rehearsal'

/** Published media CDN bucket (workstream E). Never a rehearsal bucket. */
export const CONTENT_CDN_BUCKET = 'rawkode-academy-content'

/**
 * D1 IDs are UUIDs, and Cloudflare may accept them in more than one spelling.
 * Every comparison uses this form so an uppercase or hyphenless spelling of a
 * shared ID cannot pass as a different database.
 */
export function normaliseDatabaseId(id: unknown): string {
  return typeof id === 'string' ? id.trim().toLowerCase().replaceAll('-', '') : ''
}

function sameDatabaseId(left: unknown, right: unknown): boolean {
  const normalised = normaliseDatabaseId(left)
  return normalised !== '' && normalised === normaliseDatabaseId(right)
}

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const sharedDatabaseIds = new Set([PRODUCTION_RESOURCES.databaseId, PREVIEW_RESOURCES.databaseId].map(normaliseDatabaseId))
const sharedDatabaseNames = new Set([PRODUCTION_RESOURCES.databaseName, PREVIEW_RESOURCES.databaseName])
const sharedBucketNames = new Set([PRODUCTION_RESOURCES.bucketName, PREVIEW_RESOURCES.bucketName, CONTENT_CDN_BUCKET])

export class TargetError extends Error {}

/**
 * Rehearsal runs against a dedicated, disposable D1 database and R2 bucket that
 * the operator creates for one rehearsal and deletes afterwards. Their IDs are
 * never committed, so they must be supplied explicitly.
 */
export function rehearsalResources(env: Record<string, string | undefined>): ExpectedResources {
  const databaseId = env.REHEARSAL_D1_ID?.trim()
  const bucketName = env.REHEARSAL_R2_BUCKET?.trim()
  const databaseName = env.REHEARSAL_D1_NAME?.trim() || REHEARSAL_DEFAULT_DATABASE_NAME
  const missing = [!databaseId && 'REHEARSAL_D1_ID', !bucketName && 'REHEARSAL_R2_BUCKET'].filter(Boolean)
  if (missing.length) {
    throw new TargetError(`The rehearsal target needs ${missing.join(' and ')}. Create a disposable D1 database (${REHEARSAL_DEFAULT_DATABASE_NAME}) and R2 bucket for this rehearsal, export their IDs, and delete both afterwards. Never reuse the preview or production resources.`)
  }
  if (sharedDatabaseIds.has(normaliseDatabaseId(databaseId)) || sharedDatabaseNames.has(databaseName)) {
    throw new TargetError(`REHEARSAL_D1_ID/REHEARSAL_D1_NAME point at a shared database (${databaseName} ${databaseId}). Rehearsal must use a dedicated disposable D1 database.`)
  }
  if (!canonicalUuid.test(databaseId!)) {
    throw new TargetError(`REHEARSAL_D1_ID must be a lowercase hyphenated UUID as printed by \`wrangler d1 create\`, got ${databaseId}.`)
  }
  if (sharedBucketNames.has(bucketName!)) {
    throw new TargetError(`REHEARSAL_R2_BUCKET points at a shared bucket (${bucketName}). Rehearsal must use a dedicated disposable R2 bucket.`)
  }
  // Allow-list on top of the deny-list: a live bucket or database that is not
  // named above still cannot be used unless it is named as a rehearsal resource.
  for (const [variable, name] of [['REHEARSAL_D1_NAME', databaseName], ['REHEARSAL_R2_BUCKET', bucketName!]] as const) {
    if (!name.includes('rehearsal')) throw new TargetError(`${variable}=${name} must contain "rehearsal". Rehearsal only runs against disposable resources named for it.`)
  }
  return { databaseId: databaseId!, databaseName, bucketName: bucketName! }
}

/**
 * PR previews use a disposable D1/R2 pair provisioned by
 * `scripts/pr-preview-resources.mjs`. Never resolve this target from Wrangler's
 * shared `previews` block: that D1 also holds live review data.
 */
export function pullRequestPreviewResources(env: Record<string, string | undefined>): ExpectedResources {
  const manifestPath = path.join(process.cwd(), '.runtime', 'pr-preview-resources.json')
  let manifest: Record<string, unknown> = {}
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown> }
  catch { /* an explicit env-only target may be used by a controlled rehearsal */ }

  const databaseId = env.PR_PREVIEW_D1_ID?.trim() || String(manifest.databaseId ?? '').trim()
  const databaseName = env.PR_PREVIEW_D1_NAME?.trim() || String(manifest.databaseName ?? '').trim()
  const bucketName = env.PR_PREVIEW_R2_BUCKET?.trim() || String(manifest.bucketName ?? '').trim()
  const prNumber = env.PR_PREVIEW_NUMBER?.trim() || String(manifest.pullRequestNumber ?? '').trim()
  const sha = env.PR_PREVIEW_SHA?.trim() || String(manifest.sha ?? '').trim()
  const suffix = `pr-${prNumber}-${sha.slice(0, 12)}`

  if (!/^\d+$/.test(prNumber) || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new TargetError('pr-preview: expected a PR number and full workflow SHA in PR_PREVIEW_NUMBER/PR_PREVIEW_SHA or the generated .runtime manifest.')
  }
  if (!canonicalUuid.test(databaseId)) throw new TargetError('pr-preview: PR_PREVIEW_D1_ID must be a lowercase hyphenated UUID.')
  if (databaseName !== `rawkode-academy-payload-${suffix}` || bucketName !== `rawkode-academy-payload-${suffix}`) {
    throw new TargetError('pr-preview: D1/R2 names do not match the current PR number and SHA.')
  }
  if (sameDatabaseId(databaseId, PRODUCTION_RESOURCES.databaseId) || sameDatabaseId(databaseId, PREVIEW_RESOURCES.databaseId) || databaseName === PRODUCTION_RESOURCES.databaseName || databaseName === PREVIEW_RESOURCES.databaseName || bucketName === PRODUCTION_RESOURCES.bucketName || bucketName === PREVIEW_RESOURCES.bucketName || bucketName === CONTENT_CDN_BUCKET) {
    throw new TargetError('pr-preview: refusing production, shared Preview, or published-content resources.')
  }
  return { databaseId, databaseName, bucketName }
}

function single(bindings: Binding[] | undefined, binding: string, label: string): Binding {
  const matches = (bindings ?? []).filter(candidate => candidate.binding === binding)
  if (matches.length !== 1) throw new TargetError(`${label}: expected exactly one ${binding} binding, found ${matches.length}`)
  return matches[0]!
}

function remote(binding: Binding): Binding {
  return { ...binding, remote: true }
}

/**
 * Build the explicit CLI Wrangler config for a remote target. The output never
 * contains a `previews` block: getPlatformProxy resolves preview IDs whenever
 * that block exists, which would silently send production work to preview.
 */
export function buildRemoteTargetConfig(target: RemoteTargetName, source: SourceWranglerConfig, env: Record<string, string | undefined> = process.env): ResolvedRemoteTarget {
  const base = {
    name: `${source.name}-${target}-cli`,
    account_id: source.account_id,
    main: source.main,
    compatibility_date: source.compatibility_date,
    compatibility_flags: source.compatibility_flags,
    workers_dev: false as const,
  }
  if (target === 'production') {
    const d1 = single(source.d1_databases, 'D1', 'wrangler.jsonc production')
    const r2 = single(source.r2_buckets, 'R2', 'wrangler.jsonc production')
    const config = { ...base, d1_databases: [remote(d1)], r2_buckets: [remote(r2)], vars: source.vars }
    return assertRemoteTargetConfig({ target, expected: PRODUCTION_RESOURCES, config })
  }
  if (target === 'preview') {
    const d1 = single(source.previews?.d1_databases, 'D1', 'wrangler.jsonc previews')
    const r2 = single(source.previews?.r2_buckets, 'R2', 'wrangler.jsonc previews')
    const config = { ...base, d1_databases: [remote(d1)], r2_buckets: [remote(r2)], vars: source.previews?.vars }
    return assertRemoteTargetConfig({ target, expected: PREVIEW_RESOURCES, config })
  }
  if (target === 'pr-preview') {
    const expected = pullRequestPreviewResources(env)
    const config = {
      ...base,
      d1_databases: [{ binding: 'D1', database_id: expected.databaseId, database_name: expected.databaseName, remote: true }],
      r2_buckets: [{ binding: 'R2', bucket_name: expected.bucketName, remote: true }],
      vars: source.previews?.vars,
    }
    return assertRemoteTargetConfig({ target, expected, config })
  }
  if (target === 'rehearsal') {
    const expected = rehearsalResources(env)
    // Nothing is inherited from the production bindings except the binding
    // names, so a typo in the environment cannot fall back to a shared ID.
    const config = {
      ...base,
      d1_databases: [{ binding: 'D1', database_id: expected.databaseId, database_name: expected.databaseName, remote: true }],
      r2_buckets: [{ binding: 'R2', bucket_name: expected.bucketName, remote: true }],
      vars: source.vars,
    }
    return assertRemoteTargetConfig({ target, expected, config })
  }
  throw new TargetError(`Unknown remote target: ${String(target)}`)
}

export function assertRemoteTargetConfig(resolved: ResolvedRemoteTarget): ResolvedRemoteTarget {
  const { target, expected, config } = resolved
  if ('previews' in config) throw new TargetError(`${target}: CLI config must not contain a previews block`)
  for (const binding of [...config.d1_databases, ...config.r2_buckets]) {
    if (binding.remote !== true) throw new TargetError(`${target}: binding ${String(binding.binding)} must be remote`)
  }
  const d1 = single(config.d1_databases, 'D1', target)
  const r2 = single(config.r2_buckets, 'R2', target)
  if (!sameDatabaseId(d1.database_id, expected.databaseId)) throw new TargetError(`${target}: D1 database_id ${String(d1.database_id)} does not match the expected ${expected.databaseId}`)
  if (d1.database_name !== expected.databaseName) throw new TargetError(`${target}: D1 database_name ${String(d1.database_name)} does not match the expected ${expected.databaseName}`)
  if (r2.bucket_name !== expected.bucketName) throw new TargetError(`${target}: R2 bucket_name ${String(r2.bucket_name)} does not match the expected ${expected.bucketName}`)
  if (target !== 'production' && (sameDatabaseId(d1.database_id, PRODUCTION_RESOURCES.databaseId) || r2.bucket_name === PRODUCTION_RESOURCES.bucketName)) {
    throw new TargetError(`${target}: resolved production resources`)
  }
  if (target !== 'preview' && (sameDatabaseId(d1.database_id, PREVIEW_RESOURCES.databaseId) || r2.bucket_name === PREVIEW_RESOURCES.bucketName)) {
    throw new TargetError(`${target}: resolved preview resources`)
  }
  if (r2.bucket_name === CONTENT_CDN_BUCKET) throw new TargetError(`${target}: resolved the published media CDN bucket ${CONTENT_CDN_BUCKET}`)
  return resolved
}

export type MigrationChain = 'legacy' | 'cuid2'

/** Only a disposable fresh target may use the new CUID2 schema chain. */
export function migrationChainForTarget(target: TargetName): MigrationChain {
  return target === 'preview' ? 'legacy' : 'cuid2'
}

export type PreparedTarget = { target: TargetName; migrationChain: MigrationChain; expected?: ExpectedResources; configPath?: string; cleanup: () => void }

/**
 * Point the Cloudflare platform proxy at one target. This must run before
 * src/cloudflare is imported, because that module creates the proxy at import
 * time from these environment variables.
 */
export function prepareTarget(target: TargetName, options: { projectDir?: string; env?: Record<string, string | undefined>; log?: (message: string) => void } = {}): PreparedTarget {
  const projectDir = options.projectDir ?? process.cwd()
  const env = options.env ?? process.env
  const log = options.log ?? ((message: string) => console.error(message))
  const migrationChain = migrationChainForTarget(target)
  const previousMigrationChain = env.POC_MIGRATION_CHAIN
  env.POC_MIGRATION_CHAIN = migrationChain
  const restoreMigrationChain = () => {
    if (previousMigrationChain === undefined) delete env.POC_MIGRATION_CHAIN
    else env.POC_MIGRATION_CHAIN = previousMigrationChain
  }
  env.POC_CLI = '1'
  if (target === 'local') {
    // Local means the persisted Miniflare state. Clear any inherited remote
    // settings so a stale shell cannot turn a local run into a remote one.
    delete env.POC_REMOTE_BINDINGS
    delete env.POC_CLOUDFLARE_CONFIG_PATH
    log('Target local: Miniflare D1/R2 under .wrangler/state')
    return { target, migrationChain, cleanup: restoreMigrationChain }
  }
  const source = JSON.parse(readFileSync(path.join(projectDir, 'wrangler.jsonc'), 'utf8')) as SourceWranglerConfig
  const resolved = buildRemoteTargetConfig(target, source, env)
  const runtimeDir = path.join(projectDir, '.runtime')
  const configPath = path.join(runtimeDir, `wrangler.${target}-cli.json`)
  mkdirSync(runtimeDir, { recursive: true })
  writeFileSync(configPath, JSON.stringify(resolved.config, null, 2))
  env.POC_REMOTE_BINDINGS = '1'
  env.POC_CLOUDFLARE_CONFIG_PATH = configPath
  env.POC_CLOUDFLARE_ENV_FILE = path.join(projectDir, '.dev.vars')
  log(`Target ${target}: D1 ${resolved.expected.databaseName} (${resolved.expected.databaseId}), R2 ${resolved.expected.bucketName}`)
  return { target, migrationChain, expected: resolved.expected, configPath, cleanup: () => {
    rmSync(configPath, { force: true })
    restoreMigrationChain()
  } }
}

export async function disposeCloudflare(cloudflare: unknown): Promise<void> {
  if (cloudflare && typeof cloudflare === 'object' && 'dispose' in cloudflare && typeof cloudflare.dispose === 'function') await cloudflare.dispose()
}
