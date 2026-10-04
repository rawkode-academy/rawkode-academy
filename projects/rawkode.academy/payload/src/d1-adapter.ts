import {sqliteD1Adapter} from '@payloadcms/db-d1-sqlite'

/** Pinned 3.90.2 workaround: its upsert aliases updateOne, whose default is
 * options.upsert=false. A missing preference then returns success without INSERT.
 * Keep this explicit until upstream supplies and verifies the upsert semantics.
 * This enables insert-on-miss; it does not provide atomic concurrent upserts.
 */
export function experimentalD1Adapter(options: Parameters<typeof sqliteD1Adapter>[0]) {
  const database = sqliteD1Adapter(options)
  const initialize = database.init
  database.init = args => {
    const adapter = initialize(args)
    adapter.upsert = args => adapter.updateOne({...args, options: {upsert: true}})
    return adapter
  }
  return database
}
