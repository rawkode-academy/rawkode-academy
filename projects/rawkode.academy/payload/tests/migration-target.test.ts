import assert from 'node:assert/strict'
import test from 'node:test'
import { migrations } from '../src/migrations-cuid2'
import { assertMigrationTarget, cuid2DocumentTables, cuid2MigrationNames } from '../src/id-schema'

type Result<T> = { results: T[] }

function database(options: {
  tables: string[]
  migrations?: string[]
  idTypes?: Record<string, string>
}): D1Database {
  return {
    prepare(statement: string) {
      return {
        async all<T>(): Promise<Result<T>> {
          if (statement.includes("FROM sqlite_master WHERE type='table'")) {
            return { results: options.tables.map(name => ({ name }) as unknown as T) }
          }
          if (statement === 'SELECT name FROM payload_migrations') {
            return { results: (options.migrations ?? []).map(name => ({ name }) as unknown as T) }
          }
          const table = statement.match(/^PRAGMA table_info\("([a-z_]+)"\)$/)?.[1]
          if (table) {
            return { results: (options.idTypes?.[table] ? [{ name: 'id', type: options.idTypes[table] }] : []) as unknown as T[] }
          }
          if (/^PRAGMA foreign_key_list\("[a-z_]+"\)$/.test(statement)) return { results: [] }
          throw new Error(`Unexpected D1 query: ${statement}`)
        },
      } as never
    },
  } as unknown as D1Database
}

function completeCuid2Database(migrations: string[] = [...cuid2MigrationNames]): D1Database {
  return database({
    tables: ['payload_migrations', ...cuid2DocumentTables],
    migrations,
    idTypes: Object.fromEntries(cuid2DocumentTables.map(table => [table, 'text'])),
  })
}

test('CUID2 target guard names match the registered migration chain', () => {
  assert.deepEqual(migrations.map(migration => migration.name), [...cuid2MigrationNames])
})

test('CUID2 migration accepts a fresh target and refuses a nonempty legacy target before writes', async () => {
  await assert.doesNotReject(assertMigrationTarget(database({ tables: [] }), 'cuid2'))
  await assert.rejects(
    assertMigrationTarget(database({ tables: ['videos', 'users', 'payload_migrations'], migrations: ['20261004_153744'], idTypes: { videos: 'integer', users: 'integer' } }), 'cuid2'),
    /incomplete CUID2 migration chain/,
  )
})

test('CUID2 migration refuses a nonempty target missing the terminal cleanup migration', async () => {
  const partialChain = [...cuid2MigrationNames.slice(0, -1)]
  await assert.rejects(
    assertMigrationTarget(completeCuid2Database(partialChain), 'cuid2'),
    /incomplete CUID2 migration chain.*cuid2_20261010_160000_content_schema_cleanup/,
  )
  await assert.doesNotReject(assertMigrationTarget(completeCuid2Database(), 'cuid2'))
})

test('CUID2 migration refuses an empty production target unless an explicit cutover path allows it', async () => {
  const empty = database({ tables: [] })
  await assert.rejects(
    assertMigrationTarget(empty, 'cuid2', { allowEmpty: false }),
    /production must already contain the verified, reimported CUID2 database/,
  )
  // The cutover command opts in only for the reviewed first migration of a
  // newly provisioned production D1; normal production deploys use false.
  await assert.doesNotReject(assertMigrationTarget(empty, 'cuid2', { allowEmpty: true }))
})

test('legacy migration accepts the established integer schema and refuses an empty target', async () => {
  await assert.doesNotReject(assertMigrationTarget(database({
    tables: ['videos', 'users', 'payload_migrations'],
    migrations: ['20261004_153744'],
    idTypes: { videos: 'integer', users: 'integer' },
  }), 'legacy'))
  await assert.rejects(assertMigrationTarget(database({ tables: [] }), 'legacy'), /empty or incomplete D1/)
})
