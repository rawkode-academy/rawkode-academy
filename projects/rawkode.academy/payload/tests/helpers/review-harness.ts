import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import type { TestContext } from 'node:test'
import { sql, type MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { migrations } from '../../src/migrations'
import * as enforceMigration from '../../src/pending-migrations/20261009_160000_review_revision_grants_enforce'
import { ReviewService } from '../../src/review/service'
import { ReviewStore } from '../../src/review/store'
import type { ReviewActor } from '../../src/review/contracts'

export const staff: ReviewActor = { id: 1, collection: 'users', role: 'staff' }
export const client: ReviewActor = { id: 2, collection: 'users', role: 'customer' }
export const stranger: ReviewActor = { id: 3, collection: 'users', role: 'customer' }
export const secondClient: ReviewActor = { id: 4, collection: 'users', role: 'customer' }
export const metadata = { title: 'Reviewed cut', description: 'Approved public summary', chapters: [{ title: 'Start', startTime: 0 }] }
export const command = (action: string, data = {}) => ({ action, videoId: 10, commandId: crypto.randomUUID(), ...data })
export const day = 86400000
type Options = { publicMediaUrl?: (videoId: number, publicationId: string) => string; enforce?: boolean }

export async function harness(t: TestContext, options: Options = {}) {
  const publicMediaUrl = options.publicMediaUrl ?? ((videoId: number, publicationId: string) => `https://preview.example/api/review/published-media?videoId=${videoId}&publicationId=${publicationId}`)
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec('PRAGMA foreign_keys=ON')
  const migrationArgs = { db: { run(statement: ReturnType<typeof sql>) {
    const query = statement.toQuery({ casing: undefined as never, escapeName: value => `"${value}"`, escapeParam: () => '?', escapeString: value => `'${value.replaceAll("'", "''")}'` })
    assert.equal(query.params.length, 0)
    sqlite.exec(query.sql)
  } } } as unknown as MigrateUpArgs
  for (const migration of [...migrations, ...(options.enforce ? [enforceMigration] : [])]) {
    sqlite.exec('BEGIN; PRAGMA defer_foreign_keys=ON')
    await migration.up(migrationArgs)
    sqlite.exec('COMMIT')
  }
  sqlite.exec(`INSERT INTO users(id,email,role,name) VALUES(1,'staff@example.invalid','staff','Staff Editor'),(2,'client@example.invalid','customer','First Client'),(3,'stranger@example.invalid','customer','Stranger'),(4,'second-client@example.invalid','customer','Second Client');
    INSERT INTO videos(id,legacy_id,legacy_type,slug,title,_status) VALUES(10,'stable-video','Video','stable-video','Old title','draft'),(11,'other-video','Video','other-video','Other','draft');
    INSERT INTO media(id,filename) VALUES(20,'original.mp4'),(21,'deliverable.mp4'),(22,'second-cut.mp4');
    INSERT INTO _videos_v(id,parent_id,version_legacy_id,version__status,latest) VALUES(30,10,'stable-video','draft',1);
    INSERT INTO videos_terms(id,_order,_parent_id,value) VALUES('term',1,10,'old');
    INSERT INTO _videos_v_version_terms(id,_order,_parent_id,value) VALUES(31,1,30,'old');
    INSERT INTO videos_rels(id,parent_id,path) VALUES(32,10,'guests');
    INSERT INTO _videos_v_rels(id,parent_id,path) VALUES(33,30,'version.guests');
    INSERT INTO videos_what_you_will_learn(id,_order,_parent_id,value) VALUES('learn',1,10,'old');
    INSERT INTO _videos_v_version_what_you_will_learn(id,_order,_parent_id,value) VALUES(34,1,30,'old');`)
  let failAfter = -1
  let beforeBatch: ((db: DatabaseSync) => void) | undefined
  class Prepared {
    values: (string | number | null)[] = []
    constructor(readonly query: string) {}
    bind(...values: (string | number | null)[]) { this.values = values; return this }
    async first() { return sqlite.prepare(this.query).get(...this.values) ?? null }
    async all() { return { results: sqlite.prepare(this.query).all(...this.values) } }
  }
  const db = {
    prepare: (query: string) => new Prepared(query),
    async batch(statements: Prepared[]) {
      beforeBatch?.(sqlite)
      sqlite.exec('BEGIN')
      try {
        for (const [index, statement] of statements.entries()) {
          sqlite.prepare(statement.query).run(...statement.values)
          if (index === failAfter) throw new Error('Injected database failure')
        }
        sqlite.exec('COMMIT'); return []
      } catch (error) { sqlite.exec('ROLLBACK'); throw error }
    },
  } as unknown as D1Database
  const store = new ReviewStore(db)
  const sources = new Map([[20, 'a'.repeat(64)], [21, 'b'.repeat(64)], [22, 'c'.repeat(64)]])
  let sourceWait: (() => Promise<void>) | undefined
  // Starts at real time and only moves forward: the commit guard also compares
  // grant expiry with SQLite's own clock. Every service read ticks one millisecond,
  // so rows created one after another never share a timestamp.
  let now = new Date()
  const service = new ReviewService(store, {
    async video(id) {
      const row = sqlite.prepare('SELECT * FROM videos WHERE id=?').get(id)
      if (!row) throw new Error('missing video')
      return { id, legacyId: String(row.legacy_id), slug: 'stable-video', type: 'recorded', title: 'Old title', streamUrl: 'https://wrong.invalid/old.m3u8', sourceData: { private: true }, sourceOrder: 0 }
    },
    async source(id) { await sourceWait?.(); return { checksum: sources.get(id)! } },
    async deliverable(id) { return { checksum: sources.get(id)!, durationMs: 60000, contentType: 'video/mp4' } },
    async stageRelease(videoId, publicationId, mediaId, checksum) { return { key: `review-releases/${videoId}/${publicationId}/${checksum}.mp4`, etag: 'release-etag', checksum: sources.get(mediaId)!, bytes: 10, contentType: 'video/mp4' } },
    publicMediaUrl,
    now: () => (now = new Date(now.getTime() + 1)),
  })
  async function share(revisionId: string, userId = 2, canApprove = true, days = 1, videoId = 10) {
    return service.execute(staff, command('share', { videoId, revisionId, userId, canApprove, expiresAt: new Date(now.getTime() + days * day).toISOString() }))
  }
  async function prepare() {
    const revision = await service.execute(staff, command('create-revision', { mediaId: 20, deliverableMediaId: 21, durationMs: 60000, metadata }))
    await share(revision.revisionId)
    return revision as { revisionId: string; reviewVersion: number }
  }
  async function approve(revision: { revisionId: string; reviewVersion: number }, actor = client) {
    return service.execute(actor, command('decide', { revisionId: revision.revisionId, expectedReviewVersion: revision.reviewVersion, decision: 'approved' }))
  }
  return { sqlite, migrationArgs, db, store, service, prepare, approve, share, sources,
    fail: (index: number) => { failAfter = index },
    pauseSource: (fn?: () => Promise<void>) => { sourceWait = fn },
    beforeBatch: (fn?: (db: DatabaseSync) => void) => { beforeBatch = fn },
    now: () => now,
    setNow: (date: Date) => { assert.ok(date >= now, 'the test clock only moves forward'); now = date },
    advance: (ms: number) => { now = new Date(now.getTime() + ms) },
  }
}
