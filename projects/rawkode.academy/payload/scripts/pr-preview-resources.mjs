import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeDir = path.join(projectDir, '.runtime')
const manifestPath = path.join(runtimeDir, 'pr-preview-resources.json')
const config = JSON.parse(await readFile(path.join(projectDir, 'wrangler.jsonc'), 'utf8'))
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || config.account_id
const token = process.env.CLOUDFLARE_API_TOKEN

// This is the workers.dev account suffix already used by Payload's checked-in
// OIDC preview origin and the repository's preview deployments. Keep it
// explicit so a missing CI variable cannot silently construct another host.
export const WORKERS_DEV_SUBDOMAIN = 'rawkodeacademy'

export function pullRequestIdentity(env = process.env) {
  if (env.GITHUB_EVENT_NAME !== 'pull_request') throw new Error('PR preview resources are only available from a pull_request workflow.')
  if (!env.GITHUB_EVENT_PATH) throw new Error('GITHUB_EVENT_PATH is required to identify the pull request.')
  const event = JSON.parse(requireEvent(env.GITHUB_EVENT_PATH))
  const pullRequestNumber = Number(event.pull_request?.number)
  // On pull_request workflows, GITHUB_SHA is the synthetic merge commit.
  // Preview checks/resources must use the PR head SHA, where project checks run.
  const sha = String(event.pull_request?.head?.sha || '').toLowerCase()
  if (!Number.isSafeInteger(pullRequestNumber) || pullRequestNumber < 1) throw new Error('The GitHub event has no valid pull request number.')
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('The pull_request event must contain a full 40-character head SHA.')
  return { pullRequestNumber, sha, sha12: sha.slice(0, 12) }
}

function requireEvent(eventPath) {
  return readFileSync(eventPath, 'utf8')
}

export function namesForPullRequest(pullRequestNumber, sha) {
  if (!/^\d+$/.test(String(pullRequestNumber)) || !/^[0-9a-f]{40}$/.test(String(sha))) throw new Error('Invalid PR preview identity.')
  const suffix = `pr-${pullRequestNumber}-${String(sha).slice(0, 12)}`
  return {
    suffix,
    databaseName: `rawkode-academy-payload-${suffix}`,
    bucketName: `rawkode-academy-payload-${suffix}`,
    workerName: `rawkode-academy-payload-${suffix}`,
    websiteWorkerName: `rawkode-academy-website-${suffix}`,
    websiteIsolationWorkerName: `rawkode-academy-website-${suffix}-isolation`,
    sessionTitle: `rawkode-academy-website-${suffix}-session`,
  }
}

export function payloadPreviewUrl(workerName) {
  return `https://${workerName}.${WORKERS_DEV_SUBDOMAIN}.workers.dev`
}

async function api(endpoint, init = {}) {
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required to provision or remove PR preview resources.')
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is required to provision or remove PR preview resources.')
  const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success === false) {
    const messages = Array.isArray(body.errors) ? body.errors.map(error => error.message).filter(Boolean).join('; ') : ''
    throw new Error(`Cloudflare API ${init.method ?? 'GET'} ${endpoint} failed (${response.status})${messages ? `: ${messages}` : ''}`)
  }
  return body.result
}

async function listD1() {
  const databases = []
  for (let page = 1; page <= 100; page += 1) {
    const result = await api(`/accounts/${accountId}/d1/database?per_page=100&page=${page}`)
    databases.push(...(Array.isArray(result) ? result : []))
    if (!result?.length || result.length < 100) break
  }
  return databases
}

async function listBuckets() {
  const result = await api(`/accounts/${accountId}/r2/buckets`)
  return Array.isArray(result) ? result : Array.isArray(result?.buckets) ? result.buckets : []
}

async function emptyBucket(name) {
  let cursor
  do {
    const query = new URLSearchParams({ limit: '1000' })
    if (cursor) query.set('cursor', cursor)
    const result = await api(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(name)}/objects?${query}`)
    const objects = Array.isArray(result?.objects) ? result.objects : []
    for (const object of objects) {
      if (typeof object?.key !== 'string') throw new Error(`Cloudflare returned an R2 object without a key while cleaning ${name}.`)
      await api(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(name)}/objects/${encodeURIComponent(object.key)}`, { method: 'DELETE' })
    }
    cursor = typeof result?.cursor === 'string' && result.cursor ? result.cursor : undefined
  } while (cursor)
}

async function listNamespaces() {
  const namespaces = []
  for (let page = 1; page <= 100; page += 1) {
    const result = await api(`/accounts/${accountId}/storage/kv/namespaces?per_page=100&page=${page}`)
    namespaces.push(...(Array.isArray(result) ? result : []))
    if (!result?.length || result.length < 100) break
  }
  return namespaces
}

async function ensureD1(name) {
  const existing = (await listD1()).find(database => database.name === name)
  if (existing) return { id: existing.uuid ?? existing.id, name }
  try {
    const result = await api(`/accounts/${accountId}/d1/database`, { method: 'POST', body: JSON.stringify({ name }) })
    return { id: result.uuid ?? result.id, name }
  } catch (error) {
    const raced = (await listD1()).find(database => database.name === name)
    if (raced) return { id: raced.uuid ?? raced.id, name }
    throw error
  }
}

async function ensureBucket(name) {
  if ((await listBuckets()).some(bucket => bucket.name === name)) return { name }
  try { await api(`/accounts/${accountId}/r2/buckets`, { method: 'POST', body: JSON.stringify({ name }) }) }
  catch (error) {
    if (!(await listBuckets()).some(bucket => bucket.name === name)) throw error
  }
  return { name }
}

async function ensureNamespace(title) {
  const existing = (await listNamespaces()).find(namespace => namespace.title === title)
  if (existing) return { id: existing.id, title }
  try {
    const result = await api(`/accounts/${accountId}/storage/kv/namespaces`, { method: 'POST', body: JSON.stringify({ title }) })
    return { id: result.id, title }
  } catch (error) {
    const raced = (await listNamespaces()).find(namespace => namespace.title === title)
    if (raced) return { id: raced.id, title }
    throw error
  }
}

export async function ensurePrPreviewResources() {
  const identity = pullRequestIdentity()
  const names = namesForPullRequest(identity.pullRequestNumber, identity.sha)
  const d1 = await ensureD1(names.databaseName)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(d1.id))) throw new Error('Cloudflare returned an invalid D1 database ID.')
  const r2 = await ensureBucket(names.bucketName)
  const session = await ensureNamespace(names.sessionTitle)
  const manifest = {
    pullRequestNumber: identity.pullRequestNumber,
    sha: identity.sha,
    workerName: names.workerName,
    websiteWorkerName: names.websiteWorkerName,
    websiteIsolationWorkerName: names.websiteIsolationWorkerName,
    databaseId: d1.id.toLowerCase(),
    databaseName: d1.name,
    bucketName: r2.name,
    sessionNamespaceId: session.id,
    sessionNamespaceTitle: session.title,
  }
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  console.log(JSON.stringify({ action: 'ensured', pullRequestNumber: identity.pullRequestNumber, sha: identity.sha, databaseName: d1.name, bucketName: r2.name, sessionNamespaceTitle: session.title }))
  return manifest
}

function pullRequestNumberFromArgs() {
  const arg = process.argv.find(value => value.startsWith('--pr='))
  const value = arg ? arg.slice('--pr='.length) : JSON.parse(requireEvent(process.env.GITHUB_EVENT_PATH)).pull_request?.number
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Supply --pr=<number> or run from a pull_request event.')
  return number
}

async function cleanup(pullRequestNumber) {
  const prefix = `rawkode-academy-payload-pr-${pullRequestNumber}-`
  const websitePrefix = `rawkode-academy-website-pr-${pullRequestNumber}-`
  const d1 = (await listD1()).filter(database => typeof database.name === 'string' && database.name.startsWith(prefix) && /^rawkode-academy-payload-pr-\d+-[0-9a-f]{12}$/.test(database.name))
  const buckets = (await listBuckets()).filter(bucket => typeof bucket.name === 'string' && bucket.name.startsWith(prefix) && /^rawkode-academy-payload-pr-\d+-[0-9a-f]{12}$/.test(bucket.name))
  const namespaces = (await listNamespaces()).filter(namespace => typeof namespace.title === 'string' && (namespace.title.startsWith(`${websitePrefix}`) || namespace.title.startsWith(`${prefix}`)) && /-pr-\d+-[0-9a-f]{12}-session$/.test(namespace.title))
  const scripts = []
  for (let page = 1; page <= 100; page += 1) {
    const result = await api(`/accounts/${accountId}/workers/scripts?per_page=100&page=${page}`)
    scripts.push(...(Array.isArray(result) ? result : []))
    if (!result?.length || result.length < 100) break
  }
  const workerPattern = new RegExp(`^rawkode-academy-(?:payload|website)-pr-${pullRequestNumber}-[0-9a-f]{12}(?:-isolation)?$`)
  const workers = scripts.filter(script => typeof script.id === 'string' && workerPattern.test(script.id))
  for (const worker of workers) await api(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(worker.id)}`, { method: 'DELETE' })
  for (const database of d1) await api(`/accounts/${accountId}/d1/database/${database.uuid ?? database.id}`, { method: 'DELETE' })
  for (const bucket of buckets) {
    await emptyBucket(bucket.name)
    await api(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket.name)}`, { method: 'DELETE' })
  }
  for (const namespace of namespaces) await api(`/accounts/${accountId}/storage/kv/namespaces/${namespace.id}`, { method: 'DELETE' })
  console.log(JSON.stringify({ action: 'cleaned', pullRequestNumber, workers: workers.length, d1: d1.length, r2: buckets.length, kv: namespaces.length }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = process.argv[2]
  if (action === 'ensure') await ensurePrPreviewResources()
  else if (action === 'cleanup') await cleanup(pullRequestNumberFromArgs())
  else throw new Error('Expected `ensure` or `cleanup`.')
}
