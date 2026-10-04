import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { buildClientSchema, buildSchema, findBreakingChanges, findDangerousChanges, introspectionFromSchema, isObjectType, lexicographicSortSchema, parse, printSchema, validate } from 'graphql'
import type { Payload } from 'payload'
import { createCompatibilitySchema } from '../src/compat'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFile(new URL(path, root), 'utf8')
const baseline = buildClientSchema(JSON.parse(await read('fixtures/schema-gateway.json')))
// Schema construction never accesses Payload. Runtime queries are covered by integration tests.
const actual = createCompatibilitySchema({} as Payload)
const breaking = findBreakingChanges(baseline, actual)
const dangerous = findDangerousChanges(baseline, actual)
const operations = parse(await read('fixtures/schema-operations.graphql'))
const operationErrors = validate(actual, operations).map(error => error.message)
const exactSDL = printSchema(lexicographicSortSchema(baseline)) === printSchema(lexicographicSortSchema(actual))
const exactDirectives = JSON.stringify(introspectionFromSchema(baseline).__schema.directives) === JSON.stringify(introspectionFromSchema(actual).__schema.directives)
const source = buildSchema(await read('fixtures/schema-source.graphql'), { assumeValidSDL: true })
const subgraph = buildSchema(await read('fixtures/schema-subgraph.graphql'))
const fieldNames = (schema: typeof actual, typeName: string) => {
  const type = schema.getType(typeName)
  return isObjectType(type) ? Object.keys(type.getFields()).sort() : []
}
const drift = ['Query', 'Person', 'Video', 'Show'].map(type => {
  const gatewayFields = fieldNames(baseline, type)
  const subgraphFields = fieldNames(subgraph, type)
  const sourceFields = fieldNames(source, type)
  return { type,
    subgraphOnly: subgraphFields.filter(field => !gatewayFields.includes(field)),
    gatewayOnly: gatewayFields.filter(field => !subgraphFields.includes(field)),
    sourceOnlyVsSubgraph: sourceFields.filter(field => !subgraphFields.includes(field)),
    subgraphOnlyVsSource: subgraphFields.filter(field => !sourceFields.includes(field)),
  }
})
const result = { checkedAt: new Date().toISOString(), exactSDL, exactDirectives, breaking, dangerous, operationErrors,
  mutationRoot: actual.getMutationType()?.name ?? null,
  drift, limitations: ['Exact type compatibility does not establish runtime parity for external domains.', 'Authenticated me and interaction/bracket implementations are intentionally unavailable.', 'Captured fixtures are dated evidence; run capture:schema to refresh explicitly.'] }
await mkdir(new URL('evidence/', root), { recursive: true })
await writeFile(new URL('evidence/schema-compatibility.json', root), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
if (breaking.length || operationErrors.length || !exactSDL || !exactDirectives || actual.getMutationType()) process.exitCode = 1
