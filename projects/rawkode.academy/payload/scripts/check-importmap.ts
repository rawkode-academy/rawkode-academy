import { readFile } from 'node:fs/promises'
import { missingFromImportMap, requiredComponentPaths } from '../src/admin/component-paths'
import { createCollections } from '../src/collections'

// Static check, no Cloudflare bindings: every admin component path must be in
// the committed importMap.js. Regenerate with `bun run generate:importmap`.
const collections = createCollections({ localAuth: false } as never, {} as never)
const source = await readFile(new URL('../app/(payload)/admin/importMap.js', import.meta.url), 'utf8')
const missing = missingFromImportMap(collections, source)
if (missing.length) {
	console.error(`importMap.js is missing ${missing.length} component(s). Run bun run generate:importmap.\n${missing.join('\n')}`)
	process.exit(1)
}
console.log(`importMap.js covers all ${requiredComponentPaths(collections).length} admin component paths`)
