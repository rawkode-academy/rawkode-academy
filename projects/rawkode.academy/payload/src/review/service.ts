import { commandSchema, ReviewError, validateMetadata, type ReviewActor, type ReviewMetadata } from './contracts'
import { ReviewStore, type ReviewState, type Statement } from './store'

type Revision = { id: string; video_id: number; media_id: number; deliverable_media_id: number; deliverable_checksum: string; checksum: string; duration_ms: number; review_version: number; state: string; metadata: string; decision_id: string | null; created_by_id: number; created_at: string }
type Grant = { user_id: number; active: number; can_approve: number; version: number }
type Decision = { id: string; author_id: number; revision_id: string; review_version: number; grant_version: number; decision: string }
type PublicVideo = Record<string, unknown> & { id: number; legacyId: string }
export type ReviewDependencies = {
  video(id: number, actor: ReviewActor): Promise<PublicVideo>
  publicMediaUrl(videoId: number, publicationId: string): string
  source(mediaId: number, actor: ReviewActor): Promise<{ checksum: string }>
  deliverable(mediaId: number, actor: ReviewActor): Promise<{ checksum: string; durationMs: number; contentType: string }>
  stageRelease(videoId: number, publicationId: string, mediaId: number, checksum: string, actor: ReviewActor): Promise<{ key: string; etag: string; checksum: string; bytes: number; contentType: string }>
}
const sql = (statement: string, ...values: Statement['values']): Statement => ({ sql: statement, values })
async function hash(value: unknown) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), byte => byte.toString(16).padStart(2, '0')).join('')
}
function staff(actor: ReviewActor) {
  if (actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
}
function publicProjection(video: PublicVideo, revision: Revision, at: string, mediaUrl: string) {
  const document: Record<string, unknown> = {}
  for (const field of ['id', 'legacyId', 'legacyType', 'slug', 'sourceOrder', 'subtitle', 'tagline', 'type', 'category', 'technologies', 'guests', 'episode', 'show', 'terms', 'thumbnailUrl']) {
    if (video[field] !== undefined) document[field] = video[field]
  }
  const metadata: ReviewMetadata = JSON.parse(revision.metadata)
  return { ...document, title: metadata.title, description: metadata.description, duration: Math.ceil(revision.duration_ms / 1000),
    streamUrl: mediaUrl, publishedAt: at, _status: 'published', tombstone: false,
    reviewChapters: metadata.chapters.map((chapter, index) => ({ ...chapter, legacyId: `${video.legacyId}-${revision.id}-${index}` })),
  }
}
export class ReviewService {
  constructor(readonly store: ReviewStore, readonly dependencies: ReviewDependencies) {}
  private state(videoId: number) { return this.store.one<ReviewState>('SELECT * FROM video_review_state WHERE video_id=?', videoId) }
  private grant(videoId: number, userId: number) { return this.store.one<Grant>('SELECT * FROM video_review_grants WHERE video_id=? AND user_id=? AND active=1', videoId, userId) }
  private async authorize(videoId: number, actor: ReviewActor) {
    if (actor.role !== 'staff' && !await this.grant(videoId, actor.id)) throw new ReviewError(404, 'Review not found')
  }
  async revision(videoId: number, revisionId: string, actor: ReviewActor): Promise<Revision> {
    await this.authorize(videoId, actor)
    const row = await this.store.one<Revision>('SELECT * FROM video_revisions WHERE id=? AND video_id=?', revisionId, videoId)
    if (!row) throw new ReviewError(404, 'Revision not found')
    return row
  }
  async list(actor: ReviewActor, after = 0) {
    const rows = await this.store.all<{ videoId: number; revisionId: string; metadata: string; state: string; reviewVersion: number }>(
      `SELECT s.video_id AS videoId,r.id AS revisionId,r.metadata,r.state,r.review_version AS reviewVersion
       FROM video_review_state s JOIN video_revisions r ON r.id=s.current_revision
       WHERE s.video_id>? AND (?='staff' OR EXISTS(SELECT 1 FROM video_review_grants g WHERE g.video_id=s.video_id AND g.user_id=? AND g.active=1))
       ORDER BY s.video_id LIMIT 51`, after, actor.role, actor.id)
    const items = rows.slice(0, 50).map(({ metadata, ...row }) => ({ ...row, title: (JSON.parse(metadata) as ReviewMetadata).title }))
    return { items, nextCursor: rows.length > 50 ? items.at(-1)!.videoId : null }
  }
  async read(videoId: number, actor: ReviewActor) {
    await this.authorize(videoId, actor)
    const state = await this.state(videoId)
    if (!state) throw new ReviewError(404, 'Review not found')
    const revisions = await this.store.all<Revision>('SELECT * FROM video_revisions WHERE video_id=? ORDER BY created_at,id', videoId)
    const comments = await this.store.all('SELECT id,revision_id AS revisionId,author_id AS authorId,start_ms AS startMs,end_ms AS endMs,body,resolved,resolved_by_id AS resolvedById,resolved_at AS resolvedAt,created_at AS createdAt FROM review_comments WHERE video_id=? ORDER BY created_at,id', videoId)
    const decisions = await this.store.all('SELECT id,revision_id AS revisionId,author_id AS authorId,review_version AS reviewVersion,decision,note,created_at AS createdAt FROM review_decisions WHERE video_id=? ORDER BY created_at,id', videoId)
    return { videoId, viewerId: actor.id, canApprove: actor.role === 'customer' && Boolean((await this.grant(videoId, actor.id))?.can_approve), currentRevisionId: state.current_revision, revisions: revisions.map(row => ({
      id: row.id, durationMs: row.duration_ms, reviewVersion: row.review_version, state: row.state,
      metadata: JSON.parse(row.metadata), createdAt: row.created_at,
      mediaUrl: `/api/review/media?videoId=${videoId}&revisionId=${row.id}`,
    })), comments, decisions, resolutions: await this.store.all('SELECT comment_id AS commentId,actor_id AS actorId,resolved,created_at AS createdAt FROM review_comment_resolutions WHERE video_id=? ORDER BY created_at,id', videoId),
      ...(actor.role === 'staff' ? { grants: await this.store.all('SELECT user_id AS userId,can_approve AS canApprove,active FROM video_review_grants WHERE video_id=?', videoId) } : {}),
    }
  }
  async execute(actor: ReviewActor, value: unknown) {
    const parsed = commandSchema.safeParse(value)
    if (!parsed.success) throw new ReviewError(400, 'Invalid review command')
    const input = parsed.data
    await this.authorize(input.videoId, actor)
    const inputHash = await hash(input)
    const prior = await this.store.one<{ video_id: number; actor_id: number; input_hash: string; result: string }>('SELECT * FROM review_commands WHERE id=?', input.commandId)
    if (prior) {
      if (prior.video_id !== input.videoId || prior.actor_id !== actor.id || prior.input_hash !== inputHash) throw new ReviewError(409, 'Command ID was used for another request')
      return JSON.parse(prior.result)
    }
    // All grants and mutations advance this generation; the batch guard detects
    // any concurrent change after authorization or validation, including revocation.
    const state = await this.state(input.videoId)
    // Recheck membership after the generation read so a completed revocation cannot
    // be paired with the generation it produced.
    await this.authorize(input.videoId, actor)
    const mutations: Statement[] = []
    const at = new Date().toISOString()
    const resultId = input.commandId
    let result: Record<string, unknown> = { id: resultId, action: input.action }
    if (input.action === 'grant' || input.action === 'revoke') {
      staff(actor)
      await this.dependencies.video(input.videoId, actor)
      const user = await this.store.one('SELECT id FROM users WHERE id=? AND role=?', input.userId, 'customer')
      if (!user) throw new ReviewError(400, 'Choose an existing customer account')
      mutations.push(sql('INSERT INTO video_review_grants(id,video_id,user_id,can_approve,active) VALUES(?,?,?,?,?) ON CONFLICT(video_id,user_id) DO UPDATE SET can_approve=excluded.can_approve,active=excluded.active,version=video_review_grants.version+1', resultId, input.videoId, input.userId, input.action === 'grant' && input.canApprove ? 1 : 0, input.action === 'grant' ? 1 : 0))
      result = { action: input.action, userId: input.userId }
    } else if (input.action === 'create-revision') {
      staff(actor)
      await this.dependencies.video(input.videoId, actor)
      if (input.mediaId === input.deliverableMediaId) throw new ReviewError(400, 'Keep the original private; upload a separate review deliverable')
      const source = await this.dependencies.source(input.mediaId, actor)
      const deliverable = await this.dependencies.deliverable(input.deliverableMediaId, actor)
      if (input.durationMs !== undefined && input.durationMs !== deliverable.durationMs) throw new ReviewError(400, 'Duration does not match the verified deliverable')
      validateMetadata(input.metadata, deliverable.durationMs)
      mutations.push(sql('INSERT INTO video_revisions(id,video_id,media_id,checksum,deliverable_media_id,deliverable_checksum,duration_ms,review_version,state,metadata,created_by_id,created_at) VALUES(?,?,?,?,?,?,?,1,?,?,?,?)', resultId, input.videoId, input.mediaId, source.checksum, input.deliverableMediaId, deliverable.checksum, deliverable.durationMs, 'ready', JSON.stringify(input.metadata), actor.id, at))
      mutations.push(sql('UPDATE video_review_state SET current_revision=? WHERE video_id=?', resultId, input.videoId))
      result = { revisionId: resultId, reviewVersion: 1 }
    } else if (input.action === 'resolve-comment') {
      const comment = await this.store.one<{ author_id: number }>('SELECT author_id FROM review_comments WHERE id=? AND video_id=?', input.commentId, input.videoId)
      if (!comment) throw new ReviewError(404, 'Comment not found')
      if (actor.role !== 'staff' && comment.author_id !== actor.id) throw new ReviewError(403, 'Only the author or staff can resolve this comment')
      mutations.push(sql('INSERT INTO review_comment_resolutions(id,video_id,comment_id,actor_id,resolved,created_at) VALUES(?,?,?,?,?,?)', resultId, input.videoId, input.commentId, actor.id, input.resolved ? 1 : 0, at))
      mutations.push(sql('UPDATE review_comments SET resolved=?,resolved_by_id=?,resolved_at=? WHERE id=?', input.resolved ? 1 : 0, actor.id, at, input.commentId))
      result = { commentId: input.commentId, resolved: input.resolved }
    } else {
      const revision = await this.revision(input.videoId, input.revisionId, actor)
      if (input.action === 'comment') {
        if (input.startMs >= revision.duration_ms || (input.endMs !== undefined && (input.endMs < input.startMs || input.endMs > revision.duration_ms))) throw new ReviewError(400, 'Comment timestamps must be within this revision')
        mutations.push(sql('INSERT INTO review_comments(id,video_id,revision_id,author_id,start_ms,end_ms,body,resolved,created_at) VALUES(?,?,?,?,?,?,?,0,?)', resultId, input.videoId, revision.id, actor.id, input.startMs, input.endMs ?? null, input.body, at))
        result = { commentId: resultId }
      } else {
        if (state?.current_revision !== revision.id || revision.review_version !== input.expectedReviewVersion) throw new ReviewError(409, 'The current review revision changed')
        if (input.action !== 'publish' && ['approved', 'published'].includes(revision.state)) throw new ReviewError(409, 'Approved revisions are final; create a new revision')
        if (input.action === 'edit') {
          staff(actor)
          validateMetadata(input.metadata, revision.duration_ms)
          mutations.push(sql('UPDATE video_revisions SET metadata=?,review_version=review_version+1,state=?,decision_id=NULL WHERE id=?', JSON.stringify(input.metadata), 'ready', revision.id))
          result = { revisionId: revision.id, reviewVersion: revision.review_version + 1 }
        } else if (input.action === 'decide') {
          const grant = await this.grant(input.videoId, actor.id)
          if (actor.role !== 'customer' || !grant?.can_approve) throw new ReviewError(403, 'An assigned client approver must make this decision')
          mutations.push(sql('INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)', resultId, input.videoId, revision.id, actor.id, revision.review_version, grant.version, input.decision, input.note, at))
          mutations.push(sql('UPDATE video_revisions SET state=?,decision_id=? WHERE id=?', input.decision, resultId, revision.id))
          result = { decisionId: resultId, decision: input.decision }
        } else {
          staff(actor)
          const decision = await this.store.one<Decision>('SELECT * FROM review_decisions WHERE id=? AND video_id=?', input.decisionId, input.videoId)
          if (!decision || revision.decision_id !== decision.id || revision.state !== 'approved' || decision.decision !== 'approved' || decision.revision_id !== revision.id || decision.review_version !== revision.review_version) throw new ReviewError(409, 'Current client approval is required')
          if (await this.store.one('SELECT id FROM review_comments WHERE revision_id=? AND resolved=0 LIMIT 1', revision.id)) throw new ReviewError(409, 'Resolve all comments on this revision before publication')
          const approvalGrant = await this.grant(input.videoId, decision.author_id)
          if (!approvalGrant?.can_approve || approvalGrant.version !== decision.grant_version) throw new ReviewError(409, 'The approval grant changed; a new revision and decision are required')
          if ((await this.dependencies.source(revision.media_id, actor)).checksum !== revision.checksum) throw new ReviewError(409, 'Source bytes changed since review')
          if ((await this.dependencies.deliverable(revision.deliverable_media_id, actor)).checksum !== revision.deliverable_checksum) throw new ReviewError(409, 'Deliverable bytes changed since review')
          const release = await this.dependencies.stageRelease(input.videoId, resultId, revision.deliverable_media_id, revision.deliverable_checksum, actor)
          if (release.checksum !== revision.deliverable_checksum) throw new ReviewError(409, 'Release does not match the approved deliverable')
          const video = await this.dependencies.video(input.videoId, actor)
          mutations.push(sql('INSERT INTO video_publications(id,document) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document', input.videoId, JSON.stringify(publicProjection(video, revision, at, this.dependencies.publicMediaUrl(input.videoId, resultId)))))
          mutations.push(sql('UPDATE video_revisions SET state=? WHERE id=?', 'published', revision.id))
          mutations.push(sql('INSERT INTO review_publication_events(id,video_id,revision_id,decision_id,published_by_id,published_at,object_key,object_etag,checksum,bytes,content_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)', resultId, input.videoId, revision.id, decision.id, actor.id, at, release.key, release.etag, release.checksum, release.bytes, release.contentType))
          result = { publicationId: resultId, revisionId: revision.id, publishedAt: at }
        }
      }
    }
    if (!state && !['create-revision', 'grant', 'revoke'].includes(input.action)) throw new ReviewError(404, 'Review not found')
    await this.store.commit(input.videoId, state?.generation ?? null, mutations, { id: input.commandId, actor: actor.id, hash: inputHash, result })
    return result
  }
}
