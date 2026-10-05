import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { sql, type MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { migrations } from '../src/migrations'

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
