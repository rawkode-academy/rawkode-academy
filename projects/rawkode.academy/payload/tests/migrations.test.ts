import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { sql, type MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { migrations } from '../src/migrations-cuid2'
import { cuid2DocumentTables } from '../src/id-schema'
import { createCuid2, isCuid2 } from '../src/cuid2'
import * as enforce from '../src/pending-migrations/20261009_160000_review_revision_grants_enforce'

const cuid = (prefix: string) => `${prefix}${'0'.repeat(23)}`
const queryOf = (statement: ReturnType<typeof sql>) => statement.toQuery({
  casing: undefined as never,
  escapeName: name => `"${name}"`,
  escapeParam: () => '?',
  escapeString: value => `'${value.replaceAll("'", "''")}'`,
})
const migrationDB = (sqlite: DatabaseSync) => ({
  async run(statement: ReturnType<typeof sql>) {
    const query = queryOf(statement)
    if (query.params.length) sqlite.prepare(query.sql).run(...query.params as (string | number | null)[])
    else sqlite.exec(query.sql)
  },
  async all(statement: ReturnType<typeof sql>) {
    const query = queryOf(statement)
    return sqlite.prepare(query.sql).all(...query.params as (string | number | null)[])
  },
})

// Run real migrations with FK enforcement held on, as in D1. SQLite ignores
// foreign_keys changes inside a transaction. Deferred checks do not defer
// cascades or SET NULL actions, so a parent rebuild still loses relationships.
test('content rollback preserves video IDs and relationships with foreign keys enabled', async () => {
  const sqlite = new DatabaseSync(':memory:')
  const args = { db: migrationDB(sqlite) } as unknown as MigrateUpArgs
  const apply = async (migration: (args: MigrateUpArgs) => Promise<void>) => {
    sqlite.exec('BEGIN;')
    try {
      await migration(args)
      sqlite.exec('COMMIT;')
    } catch (error) {
      sqlite.exec('ROLLBACK;')
      throw error
    }
  }
  const rows = (table: string) => sqlite.prepare(`SELECT * FROM "${table}" ORDER BY id`).all()
  const id = {
    person: cuid('p'), technology: cuid('t'), chapter: cuid('c'), show: cuid('s'), video: cuid('v'), draftVideo: cuid('w'),
    term: cuid('a'), episode: cuid('j'), module: cuid('l'), path: cuid('n'), media: cuid('u'), pipelineRun: cuid('z'), article: cuid('b'), series: cuid('g'),
  }
  try {
    sqlite.exec('PRAGMA foreign_keys=ON;')
    const target = migrations.findIndex(migration => migration.name === 'cuid2_20261004_201756')
    assert.ok(target > 0)
    for (const migration of migrations.slice(0, target)) await apply(migration.up)
    sqlite.exec(`
      INSERT INTO people (id, legacy_id) VALUES ('${id.person}', 'guest');
      INSERT INTO technologies (id, legacy_id) VALUES ('${id.technology}', 'technology');
      INSERT INTO chapters (id, legacy_id) VALUES ('${id.chapter}', 'chapter');
      INSERT INTO shows (id, legacy_id) VALUES ('${id.show}', 'show');
      INSERT INTO videos (id, legacy_id, title, _status) VALUES ('${id.video}', 'video-public', 'Public video', 'published'), ('${id.draftVideo}', 'video-draft', 'Draft video', 'draft');
      INSERT INTO _videos_v (id, parent_id, version_legacy_id, version__status, latest) VALUES (51, '${id.video}', 'video-public', 'published', 1), (52, '${id.draftVideo}', 'video-draft', 'draft', 1);
      INSERT INTO videos_terms (id, _order, _parent_id, value) VALUES ('${id.term}', 1, '${id.video}', 'Kubernetes');
      INSERT INTO _videos_v_version_terms (id, _order, _parent_id, value, _uuid) VALUES (61, 1, 51, 'Kubernetes', '${cuid('q')}');
      INSERT INTO videos_rels (id, "order", parent_id, path, people_id, technologies_id, chapters_id) VALUES
        (71, 1, '${id.video}', 'guests', '${id.person}', NULL, NULL), (72, 1, '${id.video}', 'technologies', NULL, '${id.technology}', NULL), (73, 1, '${id.draftVideo}', 'chapters', NULL, NULL, '${id.chapter}');
      INSERT INTO _videos_v_rels (id, "order", parent_id, path, people_id, technologies_id, chapters_id) VALUES
        (81, 1, 51, 'version.guests', '${id.person}', NULL, NULL), (82, 1, 51, 'version.technologies', NULL, '${id.technology}', NULL), (83, 1, 52, 'version.chapters', NULL, NULL, '${id.chapter}');
      INSERT INTO episodes (id, legacy_id, video_id) VALUES ('${id.episode}', 'episode', '${id.video}');
      UPDATE videos SET episode_id='${id.episode}' WHERE id='${id.video}';
      UPDATE _videos_v SET version_episode_id='${id.episode}' WHERE id=51;
      INSERT INTO _episodes_v (id, parent_id, version_video_id) VALUES (92, '${id.episode}', '${id.video}');
      INSERT INTO course_modules (id, legacy_id, video_id) VALUES ('${id.module}', 'module', '${id.video}');
      INSERT INTO _course_modules_v (id, parent_id, version_video_id) VALUES (102, '${id.module}', '${id.video}');
      INSERT INTO learning_paths (id, legacy_id) VALUES ('${id.path}', 'path');
      INSERT INTO _learning_paths_v (id, parent_id) VALUES (112, '${id.path}');
      INSERT INTO learning_paths_rels (id, "order", parent_id, path, videos_id) VALUES (113, 1, '${id.path}', 'videos', '${id.video}');
      INSERT INTO _learning_paths_v_rels (id, "order", parent_id, path, videos_id) VALUES (114, 1, 112, 'version.videos', '${id.video}');
      INSERT INTO media (id) VALUES ('${id.media}');
      INSERT INTO pipeline_runs (id, key, video_id, media_id, state) VALUES ('${cuid('s')}', 'run', '${id.video}', '${id.media}', 'completed');
      INSERT INTO articles (id) VALUES ('${id.article}');
      INSERT INTO articles_rels (id, parent_id, path, people_id) VALUES (142, '${id.article}', 'authors', '${id.person}');
      INSERT INTO _articles_v (id, parent_id) VALUES (143, '${id.article}');
      INSERT INTO _articles_v_rels (id, parent_id, path, people_id) VALUES (144, 143, 'version.authors', '${id.person}');
      INSERT INTO payload_locked_documents (id) VALUES (131);
      INSERT INTO payload_locked_documents_rels (id, parent_id, path, videos_id) VALUES (132, 131, 'document', '${id.video}');
    `)
    const tables = ['videos', '_videos_v', 'videos_terms', '_videos_v_version_terms', 'videos_rels', '_videos_v_rels', 'episodes', '_episodes_v', 'course_modules', '_course_modules_v', 'learning_paths_rels', '_learning_paths_v_rels', 'pipeline_runs', 'payload_locked_documents_rels', 'articles', 'articles_rels', '_articles_v', '_articles_v_rels']
    const before = Object.fromEntries(tables.map(table => [table, rows(table)]))
    const videoSchema = () => Object.fromEntries(['videos', '_videos_v'].map(table => [table, {
      columns: sqlite.prepare(`PRAGMA table_info("${table}")`).all(),
      foreignKeys: sqlite.prepare(`PRAGMA foreign_key_list("${table}")`).all(),
      indexes: sqlite.prepare('SELECT name, sql FROM sqlite_master WHERE type = ? AND tbl_name = ? ORDER BY name').all('index', table),
    }]))
    const schemaBefore = videoSchema()
    await apply(migrations[target].up)
    sqlite.exec(`UPDATE videos SET show_id='${id.show}', source_data='{"draft":false}', body='Imported body' WHERE id='${id.video}';
      UPDATE _videos_v SET version_show_id='${id.show}', version_source_data='{"draft":false}', version_body='Imported body' WHERE id=51;`)
    // A populated article->series edge also catches invalid parent-drop order.
    sqlite.exec(`INSERT INTO series (id) VALUES ('${id.series}');
      UPDATE articles SET series_id='${id.series}' WHERE id='${id.article}';
      UPDATE _articles_v SET version_series_id='${id.series}' WHERE id=143;`)
    await apply(migrations[target].down)
    for (const table of tables) assert.deepEqual(rows(table), before[table], `${table}: all rows, IDs, and references survive`)
    assert.deepEqual(videoSchema(), schemaBefore, 'video columns, indexes, and foreign keys return to the prior schema')
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
    await apply(migrations[target].up)
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  } finally {
    sqlite.close()
  }
})

test('fresh Payload schema stores every document ID and document reference as TEXT', async () => {
  const sqlite = new DatabaseSync(':memory:')
  try {
    sqlite.exec('PRAGMA foreign_keys=ON;')
    const args = { db: migrationDB(sqlite) } as unknown as MigrateUpArgs
    for (const migration of migrations) await migration.up(args)
    for (const table of cuid2DocumentTables) {
      const column = sqlite.prepare(`PRAGMA table_info("${table}")`).all().find(row => row.name === 'id')
      assert.ok(column, `${table}.id exists`)
      assert.equal(String(column.type).toLowerCase(), 'text', `${table}.id is text`)
    }
    for (const [table, name] of [['static_assets', 'legacy_id'], ['_static_assets_v', 'version_legacy_id']] as const) {
      const column = sqlite.prepare(`PRAGMA table_info("${table}")`).all().find(row => row.name === name)
      assert.ok(column, `${table}.${name} exists`)
      assert.equal(column.notnull, 0, `${table}.${name} is optional for editor-authored assets`)
    }
    for (const table of ['videos', '_videos_v', 'static_assets', '_static_assets_v']) {
      const names = sqlite.prepare(`PRAGMA table_info("${table}")`).all().map(row => String(row.name))
      assert.ok(!names.some(name => /legacy_type|source_(format|data|raw|body)|editorial_data/.test(name)), `${table} has no duplicated source payload`)
    }
    for (const [table, column, index] of [
      ['videos', 'legacy_id', 'videos_legacy_id_idx'],
      ['_videos_v', 'version_legacy_id', '_videos_v_version_version_legacy_id_idx'],
    ] as const) {
      const columns = sqlite.prepare(`PRAGMA table_info("${table}")`).all().map(row => String(row.name))
      assert.ok(!columns.includes(column), `${table}.${column} does not duplicate the video's R2 content ID`)
      assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name=?").get(index)?.n, 0, `${index} is removed`)
    }
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    for (const { name } of tables) {
      const columns = new Map((sqlite.prepare(`PRAGMA table_info("${name}")`).all() as { name: string; type: string }[]).map(column => [column.name, column.type.toLowerCase()]))
      const foreignKeys = sqlite.prepare(`PRAGMA foreign_key_list("${name}")`).all() as { from: string; table: string }[]
      for (const foreignKey of foreignKeys) {
        if (cuid2DocumentTables.includes(foreignKey.table as typeof cuid2DocumentTables[number])) {
          assert.equal(columns.get(foreignKey.from), 'text', `${name}.${foreignKey.from} references ${foreignKey.table}.id as text`)
        }
      }
    }
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  } finally {
    sqlite.close()
  }
})

test('revision grant expand preserves reviewers with canonical CUID2 IDs and enforce retires legacy grants', async t => {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec('PRAGMA foreign_keys=ON;')
  const args = { db: migrationDB(sqlite) } as unknown as MigrateUpArgs
  const apply = async (migration: (args: MigrateUpArgs) => Promise<void>) => {
    sqlite.exec('BEGIN;')
    try { await migration(args); sqlite.exec('COMMIT;') } catch (error) { sqlite.exec('ROLLBACK;'); throw error }
  }
  const thumbnails = migrations.findIndex(migration => migration.name === 'cuid2_20261007_140000_review_thumbnails')
  assert.ok(thumbnails > 0)
  for (const migration of migrations.slice(0, thumbnails + 1)) await apply(migration.up)
  const expand = migrations[thumbnails + 1]!
  assert.equal(expand.name, 'cuid2_20261009_130000_review_revision_grants')
  const checksum = (letter: string) => letter.repeat(64)
  const ids = {
    staff: cuid('s'), approver: cuid('a'), commenter: cuid('c'), inactive: cuid('i'),
    video: cuid('v'), otherVideo: cuid('w'), source: cuid('m'), oldMedia: cuid('n'), currentMedia: cuid('o'),
    oldRevision: cuid('r'), currentRevision: cuid('q'),
  }
  sqlite.exec(`INSERT INTO users(id,email,role) VALUES('${ids.staff}','staff@example.invalid','staff'),('${ids.approver}','approver@example.invalid','customer'),('${ids.commenter}','commenter@example.invalid','customer'),('${ids.inactive}','inactive@example.invalid','customer');
    INSERT INTO videos(id,title,_status) VALUES('${ids.video}','Video','draft');
    INSERT INTO media(id,filename) VALUES('${ids.source}','source.mp4'),('${ids.oldMedia}','old.mp4'),('${ids.currentMedia}','current.mp4');
    INSERT INTO video_review_state(video_id,generation,current_revision) VALUES('${ids.video}',3,'${ids.currentRevision}');
    INSERT INTO video_revisions(id,video_id,media_id,checksum,deliverable_media_id,deliverable_checksum,duration_ms,review_version,state,metadata,created_by_id,created_at) VALUES
      ('${ids.oldRevision}','${ids.video}','${ids.source}','${checksum('a')}','${ids.oldMedia}','${checksum('b')}',1000,1,'changes-requested','{}','${ids.staff}','2026-10-01T00:00:00.000Z'),
      ('${ids.currentRevision}','${ids.video}','${ids.source}','${checksum('a')}','${ids.currentMedia}','${checksum('c')}',1000,1,'ready','{}','${ids.staff}','2026-10-02T00:00:00.000Z');
    INSERT INTO video_review_grants(id,video_id,user_id,version,can_approve,active) VALUES('${cuid('h')}','${ids.video}','${ids.approver}',3,1,1),('${cuid('j')}','${ids.video}','${ids.commenter}',1,0,1),('${cuid('k')}','${ids.video}','${ids.inactive}',1,1,0);
    INSERT INTO review_comments(id,video_id,revision_id,author_id,start_ms,body,created_at) VALUES('${cuid('d')}','${ids.video}','${ids.oldRevision}','${ids.commenter}',0,'Fix this','2026-10-01T01:00:00.000Z');
    INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at) VALUES('${cuid('e')}','${ids.video}','${ids.oldRevision}','${ids.approver}',1,3,'changes-requested','','2026-10-01T02:00:00.000Z');`)
  const before = Date.now()
  await apply(expand.up)
  const grant = (revision: string, user: string) => sqlite.prepare('SELECT * FROM review_revision_grants WHERE revision_id=? AND user_id=?').get(revision, user)
  const approver = grant(ids.currentRevision, ids.approver)!
  assert.equal(approver.can_approve, 1); assert.equal(approver.version, 3)
  const migratedIds = sqlite.prepare('SELECT id FROM review_revision_grants').all().map(row => String(row.id))
  assert.equal(migratedIds.length, 4, 'current grants and prior-review history are retained')
  assert.ok(migratedIds.every(isCuid2), 'migration allocates every row ID through the CUID2 generator')
  assert.equal(grant(ids.currentRevision, ids.commenter)?.can_approve, 0)
  assert.equal(grant(ids.oldRevision, ids.commenter)?.can_approve, 0, 'the commenter keeps the cut they commented on'); assert.equal(grant(ids.oldRevision, ids.commenter)?.version, 1)
  assert.equal(grant(ids.oldRevision, ids.approver)?.can_approve, 0, 'the decider keeps the cut they decided on')
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM review_revision_grants WHERE user_id=?').get(ids.inactive)?.n, 0, 'inactive grants are not migrated')
  const expires = Date.parse(String(approver.expires_at))
  assert.match(String(approver.expires_at), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
  assert.ok(Math.abs(expires - before - 30 * 86400000) < 60000, 'backfilled grants expire after 30 days')
  assert.deepEqual({ ...sqlite.prepare('SELECT deliverable_checksum,source_checksum,grant_id FROM review_decisions').get() }, { deliverable_checksum: checksum('b'), source_checksum: checksum('a'), grant_id: grant(ids.oldRevision, ids.approver)!.id })
  assert.throws(() => sqlite.exec("UPDATE review_decisions SET note='x'"), /immutable/)
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  for (const [grantedAt, expiresAt] of [['2026-10-09 00:00:00', '2026-11-09T00:00:00.000Z'], ['2026-10-09T00:00:00.000Z', '2026-11-09T00:00:00+00:00'], ['2026-10-09T00:00:00.000Z', '2026-10-08T00:00:00.000Z']]) {
    assert.throws(() => sqlite.prepare('INSERT INTO review_revision_grants(id,video_id,revision_id,user_id,can_approve,version,granted_at,expires_at) VALUES(?,?,?,?,0,1,?,?)').run(createCuid2(), ids.video, ids.currentRevision, ids.inactive, grantedAt, expiresAt), /CHECK constraint/, `${grantedAt} ${expiresAt}`)
  }
  sqlite.exec(`INSERT INTO videos(id,title,_status) VALUES('${ids.otherVideo}','Other','draft')`)
  assert.throws(() => sqlite.prepare("INSERT INTO review_revision_grants(id,video_id,revision_id,user_id,can_approve,version,granted_at,expires_at) VALUES(?,?,?, ?,0,1,'2026-10-09T00:00:00.000Z','2026-11-09T00:00:00.000Z')").run(createCuid2(), ids.otherVideo, ids.currentRevision, ids.inactive), /Grant must belong to the revision video/)
  assert.throws(() => sqlite.prepare('UPDATE review_revision_grants SET user_id=?').run(ids.inactive), /Grant identity is immutable/)
  assert.throws(() => sqlite.exec('DELETE FROM review_revision_grants'), /Grant history is retained/)

  const currentGrantId = String(approver.id)
  assert.ok(isCuid2(currentGrantId))
  const windowDecisionId = createCuid2()
  sqlite.prepare('INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at) VALUES(?,?,?,?,?,?,?, ?,?)')
    .run(windowDecisionId, ids.video, ids.currentRevision, ids.approver, 1, 3, 'approved', '', '2026-10-09T00:00:00.000Z')
  assert.equal(sqlite.prepare('SELECT grant_id FROM review_decisions WHERE id=?').get(windowDecisionId)?.grant_id, null)
  const triggersBeforeEnforce = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%mirror%'").all()
  assert.deepEqual(triggersBeforeEnforce, [], 'no SQL trigger generates or mirrors revision grant document IDs')

  await apply(enforce.up)
  assert.deepEqual({ ...sqlite.prepare('SELECT deliverable_checksum,source_checksum,grant_id FROM review_decisions WHERE id=?').get(windowDecisionId) }, { deliverable_checksum: checksum('c'), source_checksum: checksum('a'), grant_id: currentGrantId })
  assert.throws(() => sqlite.prepare('INSERT INTO video_review_grants(id,video_id,user_id) VALUES(?,?,?)').run(cuid('l'), ids.video, ids.commenter), /Use revision grants/)
  assert.throws(() => sqlite.exec("UPDATE video_review_grants SET active=0"), /Use revision grants/)
  const triggers = () => sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND (name LIKE 'video_review_grants_%' OR name LIKE 'review_decision_%') ORDER BY name").all().map(row => String(row.name))
  assert.deepEqual(triggers(), ['review_decision_delete', 'review_decision_pin', 'review_decision_update', 'video_review_grants_retired_delete', 'video_review_grants_retired_insert', 'video_review_grants_retired_update'])
  for (const values of [`'${checksum('x')}','${checksum('a')}','${currentGrantId}'`, `NULL,'${checksum('a')}','${currentGrantId}'`, `'${checksum('c')}','${checksum('a')}',NULL`]) {
    assert.throws(() => sqlite.exec(`INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at,deliverable_checksum,source_checksum,grant_id) VALUES('${cuid('p')}','${ids.video}','${ids.currentRevision}','${ids.inactive}',1,1,'approved','','2026-10-09T00:00:00.000Z',${values})`), /Decision must pin/)
  }

  // A staff-created grant makes the expand rollback refuse.
  await apply(enforce.down)
  assert.deepEqual(triggers().filter(name => name.includes('mirror')), [], 'rollback does not restore SQL-generated legacy mirror triggers')
  sqlite.prepare('UPDATE review_revision_grants SET granted_by_id=? WHERE id=?').run(ids.staff, currentGrantId)
  await assert.rejects(apply(expand.down), /CHECK constraint/)
  assert.ok(grant(ids.currentRevision, ids.approver), 'refused rollback keeps every grant')
})

test('revision grant migrations go up, down and up again on an empty review schema', async t => {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec('PRAGMA foreign_keys=ON;')
  const args = { db: migrationDB(sqlite) } as unknown as MigrateUpArgs
  for (const migration of migrations) await migration.up(args)
  const schema = () => sqlite.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
  const expanded = schema()
  const revisionGrants = migrations.find(migration => migration.name === 'cuid2_20261009_130000_review_revision_grants')!
  await enforce.up(args)
  await enforce.down(args)
  assert.deepEqual(schema(), expanded)
  await revisionGrants.down(args)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM pragma_table_info('review_decisions') WHERE name IN ('grant_id','source_checksum','deliverable_checksum')").get()?.n, 0, 'DROP COLUMN removes the pin columns')
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='review_decision_update'").get()?.n, 1)
  await revisionGrants.up(args)
  await enforce.up(args)
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

// payload migrate (deploy.migrate and migratePreview) applies every .ts file in
// migrationDir and ignores index.ts, so an unregistered file there still ships. Staged
// contract migrations wait in src/pending-migrations instead.
test('every migration file in migrationDir is registered in index.ts, in order', async () => {
  const files = (await readdir(new URL('../src/migrations-cuid2/', import.meta.url))).filter(name => (name.endsWith('.ts') || name.endsWith('.js')) && !name.startsWith('index.')).map(name => name.split('.')[0]).sort()
  assert.deepEqual(migrations.map(migration => migration.name), files)
  assert.equal(files.some(name => name.includes('enforce')), false, 'the contract step is not released with the expand step')
})
