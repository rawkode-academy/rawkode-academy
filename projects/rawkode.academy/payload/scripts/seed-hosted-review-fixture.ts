import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import { digest } from '../src/auth/oidc'
import { authConfig } from '../src/auth/config'
import { D1AuthStore } from '../src/auth/store'
import { identityMapping } from '../src/auth/payload'

const projectDir = process.cwd()
const sourceConfig = JSON.parse(readFileSync(path.join(projectDir, 'wrangler.jsonc'), 'utf8')) as {
  name: string
  account_id?: string
  main: string
  compatibility_date: string
  compatibility_flags?: string[]
  previews: {
    d1_databases: Record<string, unknown>[]
    r2_buckets: Record<string, unknown>[]
    vars: Record<string, string>
  }
}
const runtimeDir = path.join(projectDir, '.runtime')
const bindingConfig = path.join(runtimeDir, 'wrangler.hosted-fixture.json')
mkdirSync(runtimeDir, {recursive: true})
const remote = (bindings: Record<string, unknown>[]) => bindings.map(binding => ({...binding, remote: true}))
writeFileSync(bindingConfig, JSON.stringify({
  name: `${sourceConfig.name}-hosted-fixture`,
  account_id: sourceConfig.account_id,
  main: sourceConfig.main,
  compatibility_date: sourceConfig.compatibility_date,
  compatibility_flags: sourceConfig.compatibility_flags,
  workers_dev: false,
  d1_databases: remote(sourceConfig.previews.d1_databases),
  r2_buckets: remote(sourceConfig.previews.r2_buckets),
  vars: sourceConfig.previews.vars,
}, null, 2))

process.env.POC_CLI = '1'
process.env.POC_REMOTE_BINDINGS = '1'
process.env.POC_CLOUDFLARE_CONFIG_PATH = bindingConfig
process.env.POC_CLOUDFLARE_ENV_FILE = path.join(projectDir, '.dev.vars')

const [{cloudflare}, {default: config}] = await Promise.all([
  import('../src/cloudflare'),
  import('../payload.config'),
])
const payload = await getPayload({config, disableOnInit: true})
const settings = authConfig(cloudflare.env)
const mapping = identityMapping(payload, settings)
const store = new D1AuthStore(cloudflare.env.D1)
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
const staffSubject = settings.staffSubjects[0]
if (!staffSubject) throw new Error('Hosted preview has no configured staff subject')

try {
  const staff = await mapping.map({
    issuer: settings.issuer,
    subject: staffSubject,
    name: `Synthetic preview staff ${runId}`,
    email: `preview-staff-${runId}@example.invalid`,
  })
  const customer = await mapping.map({
    issuer: settings.issuer,
    subject: `synthetic-preview-customer-${runId}`,
    name: `Synthetic preview customer ${runId}`,
    email: `preview-customer-${runId}@example.invalid`,
  })
  const tokens = {staff: crypto.randomUUID(), customer: crypto.randomUUID()}
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  await Promise.all([
    store.putSession({tokenHash: await digest(tokens.staff), userId: staff, expiresAt}),
    store.putSession({tokenHash: await digest(tokens.customer), userId: customer, expiresAt}),
  ])
  const video = await payload.create({collection: 'videos', overrideAccess: true, data: {
    legacyId: `hosted-review-${runId}`,
    legacyType: 'Video',
    slug: `hosted-review-${runId}`,
    title: `Synthetic hosted review ${runId}`,
    description: 'Disposable synthetic fixture for the deployed review lifecycle.',
    _status: 'draft',
  }})
  writeFileSync(path.join(runtimeDir, 'hosted-review-fixture.json'), JSON.stringify({
    runId,
    staff,
    customer,
    videoId: Number(video.id),
    tokens,
    expiresAt,
    origin: settings.origin,
  }, null, 2), {mode: 0o600})
  console.log(JSON.stringify({runId, videoId: Number(video.id), origin: settings.origin, expiresAt}))
} finally {
  await payload.destroy()
  rmSync(bindingConfig, {force: true})
  if ('dispose' in cloudflare && typeof cloudflare.dispose === 'function') await cloudflare.dispose()
}
