import { spawnSync } from 'node:child_process'

const sourceName = process.env.CLOUDFLARE_PREVIEW_NAME ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'local'
const safeName = sourceName
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48) || 'local'
const previewName = `pr-${safeName}`

const result = spawnSync(
  'bun',
  ['x', 'wrangler', 'preview', '--name', previewName, '--json'],
  { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] },
)

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

let payload
try {
  const jsonStart = result.stdout.lastIndexOf('{\n  "preview"')
  payload = JSON.parse(result.stdout.slice(jsonStart >= 0 ? jsonStart : 0).trim())
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
