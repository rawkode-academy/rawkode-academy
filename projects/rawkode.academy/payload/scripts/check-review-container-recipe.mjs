import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../container/', import.meta.url)
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const files = {}
for (const file of ['Dockerfile', 'contract.mjs', 'formats.mjs', 'media.mjs', 'runner.mjs']) files[file] = sha(await readFile(new URL(file, root)))
const inputs = { protocol: 1, platform: 'linux/amd64', files }
const lock = { recipe: sha(JSON.stringify(inputs)), inputs }
if (process.argv.includes('--write')) await writeFile(new URL('recipe.json', root), `${JSON.stringify(lock, null, 2)}\n`)
else if (JSON.stringify(JSON.parse(await readFile(new URL('recipe.json', root), 'utf8'))) !== JSON.stringify(lock)) throw Error('Container recipe drift: verify the changed image and explicitly regenerate its recipe')
console.log(`Container recipe verified: ${lock.recipe}`)
