import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { sql, type MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { migrations } from '../src/migrations'
import * as enforce from '../src/pending-migrations/20261009_160000_review_revision_grants_enforce'

// Run real migrations with FK enforcement held on, as in D1. SQLite ignores
// foreign_keys changes inside a transaction. Deferred checks do not defer
// cascades or SET NULL actions, so a parent rebuild still loses relationships.
test('content rollback preserves video IDs and relationships with foreign keys enabled', async () => {
  const sqlite = new DatabaseSync(':memory:')
  const args = {
    db: {
      run(statement: ReturnType<typeof sql>) {
        const query = statement.toQuery({
          casing: undefined as never,
          escapeName: name => `"${name}"`,
          escapeParam: () => '?',
          escapeString: value => `'${value.replaceAll("'", "''")}'`,
        })
        assert.equal(query.params.length, 0, 'migration uses literal SQL')
        sqlite.exec(query.sql)
        assert.equal(sqlite.prepare('PRAGMA foreign_keys').get()?.foreign_keys, 1)
      },
    },
  } as unknown as MigrateUpArgs
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
  try {
    sqlite.exec('PRAGMA foreign_keys=ON;')
    const target = migrations.findIndex(migration => migration.name === '20261004_201756')
    assert.ok(target > 0)
    for (const migration of migrations.slice(0, target)) await apply(migration.up)
    sqlite.exec(`
      INSERT INTO people (id, legacy_id) VALUES (11, 'guest');
      INSERT INTO technologies (id, legacy_id) VALUES (12, 'technology');
      INSERT INTO chapters (id, legacy_id) VALUES (13, 'chapter');
      INSERT INTO shows (id, legacy_id) VALUES (15, 'show');
      INSERT INTO videos (id, legacy_id, title, _status) VALUES (41, 'video-public', 'Public video', 'published'), (42, 'video-draft', 'Draft video', 'draft');
      INSERT INTO _videos_v (id, parent_id, version_legacy_id, version__status, latest) VALUES (51, 41, 'video-public', 'published', 1), (52, 42, 'video-draft', 'draft', 1);
      INSERT INTO videos_terms (id, _order, _parent_id, value) VALUES ('term-live', 1, 41, 'Kubernetes');
      INSERT INTO _videos_v_version_terms (id, _order, _parent_id, value, _uuid) VALUES (61, 1, 51, 'Kubernetes', 'term-version');
      INSERT INTO videos_rels (id, "order", parent_id, path, people_id, technologies_id, chapters_id) VALUES
        (71, 1, 41, 'guests', 11, NULL, NULL), (72, 1, 41, 'technologies', NULL, 12, NULL), (73, 1, 42, 'chapters', NULL, NULL, 13);
      INSERT INTO _videos_v_rels (id, "order", parent_id, path, people_id, technologies_id, chapters_id) VALUES
        (81, 1, 51, 'version.guests', 11, NULL, NULL), (82, 1, 51, 'version.technologies', NULL, 12, NULL), (83, 1, 52, 'version.chapters', NULL, NULL, 13);
      INSERT INTO episodes (id, legacy_id, video_id) VALUES (91, 'episode', 41);
      UPDATE videos SET episode_id=91 WHERE id=41;
      UPDATE _videos_v SET version_episode_id=91 WHERE id=51;
      INSERT INTO _episodes_v (id, parent_id, version_video_id) VALUES (92, 91, 41);
      INSERT INTO course_modules (id, legacy_id, video_id) VALUES (101, 'module', 41);
      INSERT INTO _course_modules_v (id, parent_id, version_video_id) VALUES (102, 101, 41);
      INSERT INTO learning_paths (id, legacy_id) VALUES (111, 'path');
      INSERT INTO _learning_paths_v (id, parent_id) VALUES (112, 111);
      INSERT INTO learning_paths_rels (id, "order", parent_id, path, videos_id) VALUES (113, 1, 111, 'videos', 41);
      INSERT INTO _learning_paths_v_rels (id, "order", parent_id, path, videos_id) VALUES (114, 1, 112, 'version.videos', 41);
      INSERT INTO media (id) VALUES (120);
      INSERT INTO pipeline_runs (id, key, video_id, media_id, state) VALUES (121, 'run', 41, 120, 'completed');
      INSERT INTO articles (id) VALUES (141);
      INSERT INTO articles_rels (id, parent_id, path, people_id) VALUES (142, 141, 'authors', 11);
      INSERT INTO _articles_v (id, parent_id) VALUES (143, 141);
      INSERT INTO _articles_v_rels (id, parent_id, path, people_id) VALUES (144, 143, 'version.authors', 11);
      INSERT INTO payload_locked_documents (id) VALUES (131);
      INSERT INTO payload_locked_documents_rels (id, parent_id, path, videos_id) VALUES (132, 131, 'document', 41);
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
    sqlite.exec(`UPDATE videos SET show_id=15, source_data='{"draft":false}', body='Imported body' WHERE id=41;
      UPDATE _videos_v SET version_show_id=15, version_source_data='{"draft":false}', version_body='Imported body' WHERE id=51;`)
    // A populated article->series edge also catches invalid parent-drop order.
    sqlite.exec(`INSERT INTO series (id) VALUES (151);
      UPDATE articles SET series_id=151 WHERE id=141;
      UPDATE _articles_v SET version_series_id=151 WHERE id=143;`)
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

test('revision grant expand preserves reviewers, mirrors legacy writes, and enforce retires legacy grants', async t => {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec('PRAGMA foreign_keys=ON;')
  const args = { db: { run(statement: ReturnType<typeof sql>) {
    const query = statement.toQuery({ casing: undefined as never, escapeName: name => `"${name}"`, escapeParam: () => '?', escapeString: value => `'${value.replaceAll("'", "''")}'` })
    assert.equal(query.params.length, 0, 'migration uses literal SQL')
    sqlite.exec(query.sql)
  } } } as unknown as MigrateUpArgs
  const apply = async (migration: (args: MigrateUpArgs) => Promise<void>) => {
    sqlite.exec('BEGIN;')
    try { await migration(args); sqlite.exec('COMMIT;') } catch (error) { sqlite.exec('ROLLBACK;'); throw error }
  }
  const thumbnails = migrations.findIndex(migration => migration.name === '20261007_140000_review_thumbnails')
  assert.ok(thumbnails > 0)
  for (const migration of migrations.slice(0, thumbnails + 1)) await apply(migration.up)
  const expand = migrations[thumbnails + 1]!
  assert.equal(expand.name, '20261009_130000_review_revision_grants')
  const checksum = (letter: string) => letter.repeat(64)
  sqlite.exec(`INSERT INTO users(id,email,role) VALUES(1,'staff@example.invalid','staff'),(2,'approver@example.invalid','customer'),(3,'commenter@example.invalid','customer'),(4,'inactive@example.invalid','customer');
    INSERT INTO videos(id,legacy_id,title,_status) VALUES(10,'video','Video','draft');
    INSERT INTO media(id,filename) VALUES(20,'source.mp4'),(21,'old.mp4'),(22,'current.mp4');
    INSERT INTO video_review_state(video_id,generation,current_revision) VALUES(10,3,'current');
    INSERT INTO video_revisions(id,video_id,media_id,checksum,deliverable_media_id,deliverable_checksum,duration_ms,review_version,state,metadata,created_by_id,created_at) VALUES
      ('old',10,20,'${checksum('a')}',21,'${checksum('b')}',1000,1,'changes-requested','{}',1,'2026-10-01T00:00:00.000Z'),
      ('current',10,20,'${checksum('a')}',22,'${checksum('c')}',1000,1,'ready','{}',1,'2026-10-02T00:00:00.000Z');
    INSERT INTO video_review_grants(id,video_id,user_id,version,can_approve,active) VALUES('approver',10,2,3,1,1),('commenter',10,3,1,0,1),('inactive',10,4,1,1,0);
    INSERT INTO review_comments(id,video_id,revision_id,author_id,start_ms,body,created_at) VALUES('comment',10,'old',3,0,'Fix this','2026-10-01T01:00:00.000Z');
    INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at) VALUES('decision',10,'old',2,1,3,'changes-requested','','2026-10-01T02:00:00.000Z');`)
  const before = Date.now()
  await apply(expand.up)
  const grant = (revision: string, user: number) => sqlite.prepare('SELECT * FROM review_revision_grants WHERE revision_id=? AND user_id=?').get(revision, user)
  const approver = grant('current', 2)!
  assert.equal(approver.can_approve, 1); assert.equal(approver.version, 3)
  assert.equal(grant('current', 3)?.can_approve, 0)
  assert.equal(grant('old', 3)?.can_approve, 0, 'the commenter keeps the cut they commented on'); assert.equal(grant('old', 3)?.version, 1)
  assert.equal(grant('old', 2)?.can_approve, 0, 'the decider keeps the cut they decided on')
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM review_revision_grants WHERE user_id=4').get()?.n, 0, 'inactive grants are not migrated')
  const expires = Date.parse(String(approver.expires_at))
  assert.match(String(approver.expires_at), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
  assert.ok(Math.abs(expires - before - 30 * 86400000) < 60000, 'backfilled grants expire after 30 days')
  assert.deepEqual({ ...sqlite.prepare('SELECT deliverable_checksum,source_checksum,grant_id FROM review_decisions').get() }, { deliverable_checksum: checksum('b'), source_checksum: checksum('a'), grant_id: grant('old', 2)!.id })
  assert.throws(() => sqlite.exec("UPDATE review_decisions SET note='x'"), /immutable/)
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  for (const [grantedAt, expiresAt] of [['2026-10-09 00:00:00', '2026-11-09T00:00:00.000Z'], ['2026-10-09T00:00:00.000Z', '2026-11-09T00:00:00+00:00'], ['2026-10-09T00:00:00.000Z', '2026-10-08T00:00:00.000Z']]) {
    assert.throws(() => sqlite.prepare("INSERT INTO review_revision_grants(id,video_id,revision_id,user_id,can_approve,version,granted_at,expires_at) VALUES('bad',10,'current',4,0,1,?,?)").run(grantedAt, expiresAt), /CHECK constraint/, `${grantedAt} ${expiresAt}`)
  }
  sqlite.exec("INSERT INTO videos(id,legacy_id,title,_status) VALUES(11,'other','Other','draft')")
  assert.throws(() => sqlite.exec("INSERT INTO review_revision_grants(id,video_id,revision_id,user_id,can_approve,version,granted_at,expires_at) VALUES('wrong-video',11,'current',4,0,1,'2026-10-09T00:00:00.000Z','2026-11-09T00:00:00.000Z')"), /Grant must belong to the revision video/)
  assert.throws(() => sqlite.exec("UPDATE review_revision_grants SET user_id=4"), /Grant identity is immutable/)
  assert.throws(() => sqlite.exec('DELETE FROM review_revision_grants'), /Grant history is retained/)

  // The previous Worker still writes legacy grants during the deploy window.
  sqlite.exec("INSERT INTO video_review_grants(id,video_id,user_id,can_approve,active) VALUES('approver-revoke',10,2,0,0) ON CONFLICT(video_id,user_id) DO UPDATE SET can_approve=excluded.can_approve,active=excluded.active,version=video_review_grants.version+1")
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM review_revision_grants WHERE user_id=2 AND revoked_at IS NULL').get()?.n, 0, 'a legacy revoke revokes every revision grant')
  sqlite.exec("INSERT INTO video_review_grants(id,video_id,user_id,can_approve,active) VALUES('approver-again',10,2,1,1) ON CONFLICT(video_id,user_id) DO UPDATE SET can_approve=excluded.can_approve,active=excluded.active,version=video_review_grants.version+1")
  assert.equal(grant('current', 2)?.revoked_at, null, 'a legacy grant re-activates the current cut')
  assert.equal(grant('current', 2)?.version, 5)
  assert.equal(grant('old', 2)?.revoked_at === null, false, 'older cuts stay revoked')
  sqlite.exec("INSERT INTO users(id,email,role) VALUES(5,'new@example.invalid','customer'); INSERT INTO video_review_grants(id,video_id,user_id,can_approve,active) VALUES('new',10,5,1,1)")
  assert.equal(grant('current', 5)?.id, 'mirror-new-current')
  // Expand installs no pin, so the old Worker's decision insert still succeeds.
  sqlite.exec("INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at) VALUES('window',10,'current',5,1,1,'changes-requested','','2026-10-09T00:00:00.000Z')")
  assert.equal(sqlite.prepare("SELECT grant_id FROM review_decisions WHERE id='window'").get()?.grant_id, null)

  await apply(enforce.up)
  assert.deepEqual({ ...sqlite.prepare("SELECT deliverable_checksum,source_checksum,grant_id FROM review_decisions WHERE id='window'").get() }, { deliverable_checksum: checksum('c'), source_checksum: checksum('a'), grant_id: 'mirror-new-current' })
  assert.throws(() => sqlite.exec("INSERT INTO video_review_grants(id,video_id,user_id) VALUES('late',10,3)"), /Use revision grants/)
  assert.throws(() => sqlite.exec("UPDATE video_review_grants SET active=0"), /Use revision grants/)
  const triggers = () => sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND (name LIKE 'video_review_grants_%' OR name LIKE 'review_decision_%') ORDER BY name").all().map(row => String(row.name))
  assert.deepEqual(triggers(), ['review_decision_delete', 'review_decision_pin', 'review_decision_update', 'video_review_grants_retired_delete', 'video_review_grants_retired_insert', 'video_review_grants_retired_update'])
  for (const values of [`'${checksum('x')}','${checksum('a')}','mirror-new-current'`, `NULL,'${checksum('a')}','mirror-new-current'`, `'${checksum('c')}','${checksum('a')}',NULL`]) {
    assert.throws(() => sqlite.exec(`INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at,deliverable_checksum,source_checksum,grant_id) VALUES('pinned',10,'current',5,1,1,'approved','','2026-10-09T00:00:00.000Z',${values})`), /Decision must pin/)
  }

  // A staff-created grant makes the expand rollback refuse.
  await apply(enforce.down)
  assert.deepEqual(triggers().filter(name => name.includes('mirror')), ['video_review_grants_mirror_insert', 'video_review_grants_mirror_revoke', 'video_review_grants_mirror_update'])
  sqlite.exec(`UPDATE review_revision_grants SET granted_by_id=1 WHERE id='mirror-new-current'`)
  await assert.rejects(apply(expand.down), /CHECK constraint/)
  assert.ok(grant('current', 5), 'refused rollback keeps every grant')
})

test('revision grant migrations go up, down and up again on an empty review schema', async t => {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec('PRAGMA foreign_keys=ON;')
  const args = { db: { run(statement: ReturnType<typeof sql>) {
    sqlite.exec(statement.toQuery({ casing: undefined as never, escapeName: name => `"${name}"`, escapeParam: () => '?', escapeString: value => `'${value.replaceAll("'", "''")}'` }).sql)
  } } } as unknown as MigrateUpArgs
  for (const migration of migrations) await migration.up(args)
  const schema = () => sqlite.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
  const expanded = schema()
  await enforce.up(args)
  await enforce.down(args)
  assert.deepEqual(schema(), expanded)
  await migrations.at(-1)!.down(args)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM pragma_table_info('review_decisions') WHERE name IN ('grant_id','source_checksum','deliverable_checksum')").get()?.n, 0, 'DROP COLUMN removes the pin columns')
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='review_decision_update'").get()?.n, 1)
  await migrations.at(-1)!.up(args)
  await enforce.up(args)
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

test('revision grant expand keeps old-Worker window decisions publishable and mirrors revocations back', async t => {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec('PRAGMA foreign_keys=ON;')
  const args = { db: { run(statement: ReturnType<typeof sql>) {
    sqlite.exec(statement.toQuery({ casing: undefined as never, escapeName: name => `"${name}"`, escapeParam: () => '?', escapeString: value => `'${value.replaceAll("'", "''")}'` }).sql)
  } } } as unknown as MigrateUpArgs
  const expandIndex = migrations.findIndex(migration => migration.name === '20261009_130000_review_revision_grants')
  for (const migration of migrations.slice(0, expandIndex)) await migration.up(args)
  const checksum = (letter: string) => letter.repeat(64)
  const revision = (id: string, createdAt: string) => `INSERT INTO video_revisions(id,video_id,media_id,checksum,deliverable_media_id,deliverable_checksum,duration_ms,review_version,state,metadata,created_by_id,created_at) VALUES('${id}',10,20,'${checksum('a')}',21,'${checksum('b')}',1000,1,'ready','{}',1,'${createdAt}')`
  const legacyGrant = (id: string, user: number, active: number) => `INSERT INTO video_review_grants(id,video_id,user_id,can_approve,active) VALUES('${id}',10,${user},1,${active}) ON CONFLICT(video_id,user_id) DO UPDATE SET can_approve=excluded.can_approve,active=excluded.active,version=video_review_grants.version+1`
  sqlite.exec(`INSERT INTO users(id,email,role) VALUES(1,'staff@example.invalid','staff'),(2,'approver@example.invalid','customer'),(3,'second@example.invalid','customer');
    INSERT INTO videos(id,legacy_id,title,_status) VALUES(10,'video','Video','draft');
    INSERT INTO media(id,filename) VALUES(20,'source.mp4'),(21,'cut.mp4');
    ${revision('r1', '2026-10-01T00:00:00.000Z')};
    INSERT INTO video_review_state(video_id,generation,current_revision) VALUES(10,1,'r1');
    INSERT INTO video_review_grants(id,video_id,user_id,version,can_approve,active) VALUES('approver',10,2,3,1,1),('second',10,3,1,1,1);`)
  await migrations[expandIndex]!.up(args)
  const grant = (revisionId: string, user: number) => sqlite.prepare('SELECT * FROM review_revision_grants WHERE revision_id=? AND user_id=?').get(revisionId, user)
  const legacy = (user: number) => sqlite.prepare('SELECT active,version FROM video_review_grants WHERE video_id=10 AND user_id=?').get(user)

  // The previous Worker creates a revision, assigns the approver, and records a decision.
  sqlite.exec(`${revision('r2', '2026-10-09T00:00:00.000Z')}; UPDATE video_review_state SET current_revision='r2' WHERE video_id=10; ${legacyGrant('approver-again', 2, 1)}`)
  assert.equal(legacy(2)?.version, 4)
  assert.equal(grant('r2', 2)?.version, 4, 'the mirrored grant carries the legacy version')
  sqlite.exec("INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at) VALUES('window',10,'r2',2,1,4,'approved','','2026-10-09T01:00:00.000Z')")
  await enforce.up(args)
  const decision = sqlite.prepare("SELECT grant_id,grant_version FROM review_decisions WHERE id='window'").get()!
  assert.equal(decision.grant_id, grant('r2', 2)!.id)
  assert.equal(decision.grant_version, grant('r2', 2)!.version, 'the window approval still matches its grant version')
  await enforce.down(args)

  // A revocation through the new Worker deactivates the legacy grant once none remain,
  // so a code-only rollback cannot restore access.
  const revoke = (revisionId: string, user: number) => sqlite.prepare("UPDATE review_revision_grants SET revoked_at=?,revoked_by_id=1,version=version+1 WHERE revision_id=? AND user_id=? AND revoked_at IS NULL").run(new Date().toISOString(), revisionId, user)
  revoke('r1', 2)
  assert.equal(legacy(2)?.active, 1, 'the approver still holds the current cut')
  revoke('r2', 2)
  assert.deepEqual({ ...legacy(2) }, { active: 0, version: 4 })
  // Revoking the last active grant must not cascade back through the legacy revoke
  // mirror into an expired grant: an approval recorded on it stays publishable.
  sqlite.exec(`INSERT INTO review_revision_grants(id,video_id,revision_id,user_id,can_approve,version,granted_by_id,granted_at,expires_at) VALUES('share-r2-3',10,'r2',3,1,1,1,'${new Date().toISOString()}','2099-01-01T00:00:00.000Z')`)
  sqlite.exec("UPDATE review_revision_grants SET granted_at='2026-01-01T00:00:00.000Z',expires_at='2026-01-02T00:00:00.000Z' WHERE revision_id='r1' AND user_id=3")
  const expired = { ...grant('r1', 3) }
  revoke('r2', 3)
  assert.equal(legacy(3)?.active, 0)
  assert.deepEqual({ ...grant('r1', 3) }, expired, 'the expired grant is neither revoked nor re-versioned')
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

// payload migrate (deploy.migrate and migratePreview) applies every .ts file in
// migrationDir and ignores index.ts, so an unregistered file there still ships. Staged
// contract migrations wait in src/pending-migrations instead.
test('every migration file in migrationDir is registered in index.ts, in order', async () => {
  const files = (await readdir(new URL('../src/migrations/', import.meta.url))).filter(name => (name.endsWith('.ts') || name.endsWith('.js')) && !name.startsWith('index.')).map(name => name.split('.')[0]).sort()
  assert.deepEqual(migrations.map(migration => migration.name), files)
  assert.equal(files.some(name => name.includes('enforce')), false, 'the contract step is not released with the expand step')
})
