import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFile, readFile, unlink, writeFile } from 'node:fs/promises'
import { namesForPullRequest, payloadPreviewUrl, pullRequestIdentity } from './pr-preview-resources.mjs'

const pullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request'
const identity = pullRequest ? pullRequestIdentity() : undefined
const prManifest = pullRequest ? JSON.parse(await readFile('.runtime/pr-preview-resources.json', 'utf8')) : undefined
if (identity && (prManifest?.pullRequestNumber !== identity.pullRequestNumber || prManifest?.sha !== identity.sha)) {
  throw new Error('Refusing to deploy: the isolated Payload resources do not match this PR/SHA.')
}
const sourceName = process.env.CLOUDFLARE_PREVIEW_NAME ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'local'
const safeName = sourceName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'local'
const previewName = identity ? namesForPullRequest(identity.pullRequestNumber, identity.sha).workerName : `pr-${safeName}`
const generatedConfig = pullRequest ? 'wrangler.preview.pr.jsonc' : undefined
const generatedSecrets = pullRequest ? `.runtime/pr-preview-${identity.pullRequestNumber}-${identity.sha.slice(0, 12)}.vars` : '.dev.vars'

if (pullRequest) {
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'))
  const workerName = previewName
  config.name = workerName
  config.workers_dev = true
  config.preview_urls = true
  // Deploy a stable per-PR service with only its own content resources. The
  // checked-in D1/R2 are production bindings, so replace them as well as the
  // old shared `previews` block before invoking Wrangler.
  delete config.routes
  delete config.previews
  config.d1_databases = [{ binding: 'D1', database_id: prManifest.databaseId, database_name: prManifest.databaseName, remote: true }]
  config.r2_buckets = [{ binding: 'R2', bucket_name: prManifest.bucketName, remote: true }]
  // The website preview needs only its isolated content resources and the
  // bounded D2 renderer used by Payload save hooks. Do not create per-PR
  // workflow, AI, or FFmpeg resources.
  delete config.workflows
  delete config.ai
  config.containers = (config.containers ?? []).filter(resource => resource.class_name === 'D2RenderContainer')
  if (config.durable_objects) {
    config.durable_objects.bindings = (config.durable_objects.bindings ?? []).filter(binding => binding.name === 'D2_RENDERER')
  }
  config.exports = config.exports?.D2RenderContainer ? { D2RenderContainer: config.exports.D2RenderContainer } : {}
  config.services = [{ binding: 'WORKER_SELF_REFERENCE', service: workerName }]
  config.vars = {
    ...(config.vars ?? {}),
    PAYLOAD_PREVIEW_PR: String(identity.pullRequestNumber),
    PAYLOAD_PREVIEW_SHA: identity.sha,
    // The preview is a public read service with no provisioned users. Keep
    // Payload's origin validator on the safe loopback-only configuration; its
    // workers.dev URL is not an identity origin and must not gain admin auth.
    OIDC_DIRECT_ORIGINS: '["http://127.0.0.1:3100"]',
    OIDC_BRIDGE_ORIGINS: '[]',
    OIDC_STAFF_SUBJECTS: '[]',
    DEVELOPER_SUBJECTS: '[]',
    REVIEW_PUBLIC_MEDIA_ORIGIN: 'http://127.0.0.1:3100',
  }
  await writeFile(generatedConfig, `${JSON.stringify(config, null, 2)}\n`)

  // The CI preview receives fresh isolated secrets, never local .dev.vars or
  // a production secret. Reuse them only for retries of this same PR/SHA.
  try { await readFile(generatedSecrets) }
  catch {
    const secrets = `PAYLOAD_SECRET=${randomBytes(32).toString('hex')}\nPIPELINE_CALLBACK_SECRET=${randomBytes(32).toString('hex')}\n`
    await writeFile(generatedSecrets, secrets, { mode: 0o600 })
  }
}

console.log(`Starting Wrangler Preview ${previewName} (Cloudflare token configured: ${Boolean(process.env.CLOUDFLARE_API_TOKEN)})`)

async function runPreview(configPath, secretsFile) {
  const args = ['node_modules/wrangler/bin/wrangler.js', pullRequest ? 'deploy' : 'preview', '--secrets-file', secretsFile]
  if (!pullRequest) args.push('--name', previewName, '--json')
  if (configPath) args.push('--config', configPath)
  const child = spawn('node', args, { env: {...process.env, CI: 'true'}, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = '', stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { stdout += chunk; process.stdout.write(chunk) })
  child.stderr.on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk) })
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (status, signal) => resolve({ status, signal }))
  })
  return { ...result, stdout, stderr }
}

let degradedConfig
try {
  let result = await runPreview(generatedConfig, generatedSecrets)
  if (
    result.status !== 0 &&
    process.env.CLOUDFLARE_PREVIEW_ALLOW_DEGRADED_CONTAINERS === 'true' &&
    /containers\/me/.test(result.stderr) &&
    /Forbidden|Authentication error/.test(result.stderr)
  ) {
    // Keep the retry fail-closed: media processing and save-time D2 rendering
    // remain unavailable without Containers, while seeded public content is testable.
    const config = JSON.parse(await readFile(generatedConfig ?? 'wrangler.jsonc', 'utf8'))
    delete config.containers
    delete config.durable_objects
    delete config.exports
    if (config.previews) {
      delete config.previews.containers
      delete config.previews.durable_objects
    }
    degradedConfig = 'wrangler.preview.degraded.json'
    await writeFile(degradedConfig, `${JSON.stringify(config, null, 2)}\n`)
    console.warn('Cloudflare Containers are not permitted for this token; retrying without Containers. The preview can check seeded D2 SVG delivery, but CMS D2 renders fail closed.')
    result = await runPreview(degradedConfig, generatedSecrets)
  }

  if (result.status !== 0) {
    if (result.signal) console.error(`Wrangler exited from signal ${result.signal}`)
    throw new Error(`Wrangler preview deployment failed with exit code ${result.status ?? 1}.`)
  }

  let previewUrl
  if (pullRequest) {
    previewUrl = payloadPreviewUrl(previewName)
  } else {
    let payload
    try {
      const jsonStart = result.stdout.lastIndexOf('{\n  "preview"')
      payload = JSON.parse(result.stdout.slice(jsonStart >= 0 ? jsonStart : 0).trim())
    } catch (error) {
      throw new Error(`Wrangler did not return preview JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
    const urls = [
      ...(payload?.preview?.urls ?? []),
      ...(payload?.deployment?.urls ?? []),
      ...(payload?.urls ?? []),
    ]
    previewUrl = urls.find((url) => typeof url === 'string')
    if (!previewUrl) throw new Error(`Wrangler returned no Preview URL: ${JSON.stringify(payload)}`)
  }

  console.log(`Preview URL: ${previewUrl}`)
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `payload_preview_url=${previewUrl}\npayload_preview_worker=${previewName}\n`)
  }
} finally {
  if (generatedConfig) await unlink(generatedConfig).catch(() => {})
  if (degradedConfig) await unlink(degradedConfig).catch(() => {})
  if (pullRequest) await unlink(generatedSecrets).catch(() => {})
}
