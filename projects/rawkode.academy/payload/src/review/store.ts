import { ReviewError } from './contracts'

export type ReviewState = { video_id: number; generation: number; current_revision: string | null }
export type Statement = { sql: string; values: (string | number | null)[] }
export class ReviewStore {
  constructor(readonly db: D1Database) {}
  async one<T>(sql: string, ...values: Statement['values']): Promise<T | null> {
    return this.db.prepare(sql).bind(...values).first<T>()
  }
  async all<T>(sql: string, ...values: Statement['values']): Promise<T[]> {
    return (await this.db.prepare(sql).bind(...values).all<T>()).results
  }
  // Each guard is a SQL expression that must evaluate to 1 inside the batch, so a
  // precondition checked before the batch (such as an active grant) is rechecked atomically.
  async commit(videoId: number, generation: number | null, statements: Statement[], command: { id: string; actor: number; hash: string; result: unknown }, guards: Statement[] = []) {
    const token = crypto.randomUUID()
    const guard = generation === null
      ? { sql: 'INSERT INTO review_command_guards(id,valid) SELECT ?, CASE WHEN NOT EXISTS(SELECT 1 FROM video_review_state WHERE video_id=?) AND EXISTS(SELECT 1 FROM videos WHERE id=? AND tombstone=0 AND processing_run IS NULL AND NOT EXISTS(SELECT 1 FROM pipeline_runs WHERE video_id=videos.id)) THEN 1 ELSE 0 END', values: [token, videoId, videoId] }
      : { sql: 'INSERT INTO review_command_guards(id,valid) SELECT ?, CASE WHEN EXISTS(SELECT 1 FROM video_review_state WHERE video_id=? AND generation=?) THEN 1 ELSE 0 END', values: [token, videoId, generation] }
    const state = generation === null
      ? { sql: 'INSERT INTO video_review_state(video_id,generation) VALUES(?,1)', values: [videoId] }
      : { sql: 'UPDATE video_review_state SET generation=generation+1 WHERE video_id=?', values: [videoId] }
    const checks = guards.map(check => ({ token: crypto.randomUUID(), check }))
    const batch: Statement[] = [guard, ...checks.map(({ token, check }) => ({ sql: `INSERT INTO review_command_guards(id,valid) SELECT ?, ${check.sql}`, values: [token, ...check.values] })), state, ...statements,
      { sql: 'INSERT INTO review_commands(id,video_id,actor_id,input_hash,result) VALUES(?,?,?,?,?)', values: [command.id, videoId, command.actor, command.hash, JSON.stringify(command.result)] },
      ...checks.map(({ token }) => ({ sql: 'DELETE FROM review_command_guards WHERE id=?', values: [token] })),
      { sql: 'DELETE FROM review_command_guards WHERE id=?', values: [token] },
    ]
    try {
      await this.db.batch(batch.map(s => this.db.prepare(s.sql).bind(...s.values)))
    } catch (error) {
      if (/CHECK constraint failed|UNIQUE constraint failed|Decision must pin|Use revision grants|Grant must belong to the revision video|Grant identity is immutable/.test(String(error))) throw new ReviewError(409, 'Review changed or command already completed; refresh and retry')
      throw error
    }
  }
}
