import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import type { TestContext } from 'node:test'
import { sql, type MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { migrations } from '../../src/migrations-cuid2'
import * as enforceMigration from '../../src/pending-migrations/20261009_160000_review_revision_grants_enforce'
import { ReviewService } from '../../src/review/service'
import { ReviewStore } from '../../src/review/store'
import type { ReviewActor } from '../../src/review/contracts'
import { CLIENT_ID, DELIVERABLE_MEDIA_ID, OTHER_VIDEO_ID, SECOND_CLIENT_ID, SECOND_DELIVERABLE_MEDIA_ID, SOURCE_MEDIA_ID, STAFF_ID, STRANGER_ID, VIDEO_ID } from './ids'
import { createCuid2 } from '../../src/cuid2'

export { CLIENT_ID, DELIVERABLE_MEDIA_ID, OTHER_VIDEO_ID, SECOND_CLIENT_ID, SECOND_DELIVERABLE_MEDIA_ID, SOURCE_MEDIA_ID, STAFF_ID, STRANGER_ID, VIDEO_ID }
export const staff: ReviewActor = { id: STAFF_ID, collection: 'users', role: 'staff' }
export const client: ReviewActor = { id: CLIENT_ID, collection: 'users', role: 'customer' }
export const stranger: ReviewActor = { id: STRANGER_ID, collection: 'users', role: 'customer' }
export const secondClient: ReviewActor = { id: SECOND_CLIENT_ID, collection: 'users', role: 'customer' }
export const metadata = { title: 'Reviewed cut', description: 'Approved public summary', chapters: [{ title: 'Start', startTime: 0 }] }
export const command = (action: string, data = {}) => ({ action, videoId: VIDEO_ID, commandId: createCuid2(), ...data })
export const day = 86400000
type Options = { publicMediaUrl?: (videoId: string, publicationId: string) => string; enforce?: boolean }

export async function harness(t: TestContext, options: Options = {}) {
  const publicMediaUrl = options.publicMediaUrl ?? ((videoId: string, publicationId: string) => `https://preview.example/api/review/published-media?videoId=${videoId}&publicationId=${publicationId}`)
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec('PRAGMA foreign_keys=ON')
  const migrationArgs = { db: {
    async run(statement: ReturnType<typeof sql>) {
      const query = statement.toQuery({ casing: undefined as never, escapeName: value => `"${value}"`, escapeParam: () => '?', escapeString: value => `'${value.replaceAll("'", "''")}'` })
      if (query.params.length) sqlite.prepare(query.sql).run(...query.params as (string | number | null)[])
      else sqlite.exec(query.sql)
    },
    async all(statement: ReturnType<typeof sql>) {
      const query = statement.toQuery({ casing: undefined as never, escapeName: value => `"${value}"`, escapeParam: () => '?', escapeString: value => `'${value.replaceAll("'", "''")}'` })
      return sqlite.prepare(query.sql).all(...query.params as (string | number | null)[])
    },
  } } as unknown as MigrateUpArgs
  for (const migration of [...migrations, ...(options.enforce ? [enforceMigration] : [])]) {
    sqlite.exec('BEGIN; PRAGMA defer_foreign_keys=ON')
    await migration.up(migrationArgs)
    sqlite.exec('COMMIT')
  }
  sqlite.exec(`INSERT INTO users(id,email,role,name) VALUES('${STAFF_ID}','staff@example.invalid','staff','Staff Editor'),('${CLIENT_ID}','client@example.invalid','customer','First Client'),('${STRANGER_ID}','stranger@example.invalid','customer','Stranger'),('${SECOND_CLIENT_ID}','second-client@example.invalid','customer','Second Client');
    INSERT INTO videos(id,legacy_id,legacy_type,slug,title,_status) VALUES('${VIDEO_ID}','stable-video','Video','stable-video','Old title','draft'),('${OTHER_VIDEO_ID}','other-video','Video','other-video','Other','draft');
    INSERT INTO media(id,filename) VALUES('${SOURCE_MEDIA_ID}','original.mp4'),('${DELIVERABLE_MEDIA_ID}','deliverable.mp4'),('${SECOND_DELIVERABLE_MEDIA_ID}','second-cut.mp4');
    INSERT INTO _videos_v(id,parent_id,version_legacy_id,version__status,latest) VALUES(30,'${VIDEO_ID}','stable-video','draft',1);
    INSERT INTO videos_terms(id,_order,_parent_id,value) VALUES('term',1,'${VIDEO_ID}','old');
    INSERT INTO _videos_v_version_terms(id,_order,_parent_id,value) VALUES(31,1,30,'old');
    INSERT INTO videos_rels(id,parent_id,path) VALUES(32,'${VIDEO_ID}','guests');
    INSERT INTO _videos_v_rels(id,parent_id,path) VALUES(33,30,'version.guests');
    INSERT INTO videos_what_you_will_learn(id,_order,_parent_id,value) VALUES('learn',1,'${VIDEO_ID}','old');
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
  const sources = new Map([[SOURCE_MEDIA_ID, 'a'.repeat(64)], [DELIVERABLE_MEDIA_ID, 'b'.repeat(64)], [SECOND_DELIVERABLE_MEDIA_ID, 'c'.repeat(64)]])
  let sourceWait: (() => Promise<void>) | undefined
  // Starts at real time and only moves forward: the commit guard also compares
  // grant expiry with SQLite's own clock. Every service read ticks one millisecond,
  // so rows created one after another never share a timestamp.
  let now = new Date()
  const service = new ReviewService(store, {
    async video(id) {
      const row = sqlite.prepare('SELECT * FROM videos WHERE id=?').get(id)
      if (!row) throw new Error('missing video')
      return { id, legacyId: String(row.legacy_id), slug: 'stable-video', type: 'recorded', title: 'Old title', streamUrl: 'https://wrong.invalid/old.m3u8', sourceOrder: 0 }
    },
    async source(id) { await sourceWait?.(); return { checksum: sources.get(id)! } },
    async deliverable(id) { return { checksum: sources.get(id)!, durationMs: 60000, contentType: 'video/mp4' } },
    async stageRelease(videoId, publicationId, mediaId, checksum) { return { key: `review-releases/${videoId}/${publicationId}/${checksum}.mp4`, etag: 'release-etag', checksum: sources.get(mediaId)!, bytes: 10, contentType: 'video/mp4' } },
    publicMediaUrl,
    now: () => (now = new Date(now.getTime() + 1)),
  })
  async function share(revisionId: string, userId = CLIENT_ID, canApprove = true, days = 1, videoId = VIDEO_ID) {
    return service.execute(staff, command('share', { videoId, revisionId, userId, canApprove, expiresAt: new Date(now.getTime() + days * day).toISOString() }))
  }
  async function prepare() {
    const revision = await service.execute(staff, command('create-revision', { mediaId: SOURCE_MEDIA_ID, deliverableMediaId: DELIVERABLE_MEDIA_ID, durationMs: 60000, metadata }))
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
