import { writeFile } from 'node:fs/promises'
import { createCollections } from '../src/collections'
import { flattenDataShape } from '../src/admin/shape'

// Snapshot of the stored data shape. Regenerate only together with a reviewed
// migration; tests/admin-config.test.ts fails on any unexpected drift.
const collections = createCollections({ localAuth: false } as never, {} as never)
const target = new URL('../fixtures/admin-field-shape.json', import.meta.url)
await writeFile(target, `${JSON.stringify(flattenDataShape(collections), null, '\t')}\n`)
console.log(`Wrote ${target.pathname}`)
