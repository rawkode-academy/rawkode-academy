import { spawn } from 'node:child_process'

const sourceName = process.env.CLOUDFLARE_PREVIEW_NAME ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'local'
const safeName = sourceName
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48) || 'local'
const previewName = `pr-${safeName}`

const child = spawn(
  'bun',
  ['x', 'wrangler', 'preview', '--name', previewName, '--json'],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
)

let stdout = ''
child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')
child.stdout.on('data', (chunk) => {
  stdout += chunk
  process.stdout.write(chunk)
})
child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk)
})

const result = await new Promise((resolve, reject) => {
  child.once('error', reject)
  child.once('close', (status, signal) => resolve({ status, signal }))
})

if (result.status !== 0) {
  if (result.signal) console.error(`Wrangler exited from signal ${result.signal}`)
  process.exit(result.status ?? 1)
}

let payload
try {
  const jsonStart = stdout.lastIndexOf('{\n  "preview"')
  payload = JSON.parse(stdout.slice(jsonStart >= 0 ? jsonStart : 0).trim())
} catch (error) {
  console.error('Wrangler did not return preview JSON:', error)
  process.exit(1)
}

const urls = [
  ...(payload?.preview?.urls ?? []),
  ...(payload?.deployment?.urls ?? []),
  ...(payload?.urls ?? []),
]
const previewUrl = urls.find((url) => typeof url === 'string')
if (!previewUrl) {
  console.error('Wrangler returned no Preview URL:', JSON.stringify(payload))
  process.exit(1)
}

console.log(`Preview URL: ${previewUrl}`)
