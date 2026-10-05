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
  async commit(videoId: number, generation: number | null, statements: Statement[], command: { id: string; actor: number; hash: string; result: unknown }) {
    const token = crypto.randomUUID()
    const guard = generation === null
      ? { sql: 'INSERT INTO review_command_guards(id,valid) SELECT ?, CASE WHEN NOT EXISTS(SELECT 1 FROM video_review_state WHERE video_id=?) AND EXISTS(SELECT 1 FROM videos WHERE id=? AND tombstone=0 AND processing_run IS NULL AND NOT EXISTS(SELECT 1 FROM pipeline_runs WHERE video_id=videos.id)) THEN 1 ELSE 0 END', values: [token, videoId, videoId] }
      : { sql: 'INSERT INTO review_command_guards(id,valid) SELECT ?, CASE WHEN EXISTS(SELECT 1 FROM video_review_state WHERE video_id=? AND generation=?) THEN 1 ELSE 0 END', values: [token, videoId, generation] }
    const state = generation === null
      ? { sql: 'INSERT INTO video_review_state(video_id,generation) VALUES(?,1)', values: [videoId] }
      : { sql: 'UPDATE video_review_state SET generation=generation+1 WHERE video_id=?', values: [videoId] }
    const batch: Statement[] = [guard, state, ...statements,
      { sql: 'INSERT INTO review_commands(id,video_id,actor_id,input_hash,result) VALUES(?,?,?,?,?)', values: [command.id, videoId, command.actor, command.hash, JSON.stringify(command.result)] },
      { sql: 'DELETE FROM review_command_guards WHERE id=?', values: [token] },
    ]
    try {
      await this.db.batch(batch.map(s => this.db.prepare(s.sql).bind(...s.values)))
    } catch (error) {
      if (/CHECK constraint failed|UNIQUE constraint failed/.test(String(error))) throw new ReviewError(409, 'Review changed or command already completed; refresh and retry')
      throw error
    }
  }
}
