import { commandSchema, maximumGrantDays, ReviewError, validateMetadata, type ReviewActor, type ReviewMetadata } from './contracts'
import { ReviewAccess, type Revision } from './access'
import { ReviewStore, type ReviewState, type Statement } from './store'

type Decision = { id: string; author_id: number; revision_id: string; review_version: number; grant_version: number; decision: string; deliverable_checksum: string | null; source_checksum: string | null; grant_id: string | null }
type PublicVideo = Record<string, unknown> & { id: number; legacyId: string }
export type ReviewDependencies = {
  video(id: number, actor: ReviewActor): Promise<PublicVideo>
  publicMediaUrl(videoId: number, publicationId: string): string
  source(mediaId: number, actor: ReviewActor, videoId: number): Promise<{ checksum: string }>
  deliverable(mediaId: number, actor: ReviewActor, videoId: number): Promise<{ checksum: string; durationMs: number; contentType: string }>
  thumbnail?(videoId: number, thumbnailId: number): Promise<void>
  assertPair?(videoId: number, sourceId: number, deliverableId: number): Promise<void>
  // publicUrl, when present, is where the approved rendition is served publicly (a
  // Studio recording publishes its HLS on the content CDN); otherwise publicMediaUrl.
  stageRelease(videoId: number, publicationId: string, mediaId: number, checksum: string, actor: ReviewActor): Promise<{ key: string; etag: string; checksum: string; bytes: number; contentType: string; publicUrl?: string }>
  now?(): Date
}
// One answer for every reason a customer cannot sign off, so the refusal never reveals
// another client's decision or a cut that has not been shared with them.
const signOffClosed = 'This revision is not open for sign-off; refresh the review'
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
  constructor(readonly store: ReviewStore, readonly dependencies: ReviewDependencies, readonly access = new ReviewAccess(store, dependencies.now)) {}
  async validateThumbnail(videoId: number, thumbnailId?: number) {
    if (thumbnailId === undefined) return
    if (!this.dependencies.thumbnail) throw new ReviewError(503, 'Thumbnail verification is unavailable')
    await this.dependencies.thumbnail(videoId, thumbnailId)
  }
  private state(videoId: number) { return this.store.one<ReviewState>('SELECT * FROM video_review_state WHERE video_id=?', videoId) }
  // Media, thumbnail and byte-range routes call this on every GET, HEAD and Range request.
  async revision(videoId: number, revisionId: string, actor: ReviewActor): Promise<Revision> {
    return (await this.access.require(actor, videoId, revisionId, 'view')).revision
  }
  async list(actor: ReviewActor, after = 0) {
    const rows = await this.access.listVisible(actor, after)
    const items = rows.slice(0, 50).map(({ metadata, ...row }) => ({ ...row, title: (JSON.parse(metadata) as ReviewMetadata).title }))
    return { items, nextCursor: rows.length > 50 ? items.at(-1)!.videoId : null }
  }
  async read(videoId: number, actor: ReviewActor) {
    await this.access.requireVideo(actor, videoId)
    const state = await this.state(videoId)
    if (!state) throw new ReviewError(404, 'Review not found')
    const grants = await this.access.visibleGrants(actor, videoId)
    // requireVideo guarantees a customer holds at least one active grant here.
    const ids = grants === 'all' ? [] : grants.map(grant => grant.revision_id)
    const visible = (column: string) => grants === 'all' ? { sql: '', values: [] } : { sql: ` AND ${column} IN (${ids.map(() => '?').join(',')})`, values: ids }
    const revisionFilter = visible('r.id'), commentRevisions = visible('c.revision_id'), comments = this.access.commentFilter(actor)
    const stateColumn = this.access.stateColumn(actor)
    const revisions = await this.store.all<Revision & { viewer_state: string }>(`SELECT r.*,${stateColumn.sql} AS viewer_state FROM video_revisions r WHERE r.video_id=?${revisionFilter.sql} ORDER BY r.created_at,r.id`, ...stateColumn.values, videoId, ...revisionFilter.values)
    const commentRows = await this.store.all(`SELECT c.id,c.revision_id AS revisionId,c.author_id AS authorId,c.start_ms AS startMs,c.end_ms AS endMs,c.body,c.resolved,c.resolved_by_id AS resolvedById,c.resolved_at AS resolvedAt,c.created_at AS createdAt FROM review_comments c WHERE c.video_id=?${commentRevisions.sql}${comments.sql} ORDER BY c.created_at,c.id`, videoId, ...commentRevisions.values, ...comments.values)
    const own = visible('revision_id')
    const decisions = await this.store.all<{ id: string; revisionId: string; authorId: number; reviewVersion: number; decision: string; note: string; createdAt: string }>(`SELECT id,revision_id AS revisionId,author_id AS authorId,review_version AS reviewVersion,decision,note,created_at AS createdAt FROM review_decisions WHERE video_id=?${grants === 'all' ? '' : ' AND author_id=?'}${own.sql} ORDER BY created_at,id`, videoId, ...(grants === 'all' ? [] : [actor.id]), ...own.values)
    const resolutions = await this.store.all(`SELECT r.comment_id AS commentId,r.actor_id AS actorId,r.resolved,r.created_at AS createdAt FROM review_comment_resolutions r JOIN review_comments c ON c.id=r.comment_id WHERE r.video_id=?${commentRevisions.sql}${comments.sql} ORDER BY r.created_at,r.id`, videoId, ...commentRevisions.values, ...comments.values)
    const grantFor = (revisionId: string) => grants === 'all' ? undefined : grants.find(grant => grant.revision_id === revisionId)
    const shared = state.current_revision && revisions.some(row => row.id === state.current_revision) ? state.current_revision : null
    // A customer's current revision is their newest shared one, so an unshared newer cut
    // changes nothing they can see. Sign-off stays limited to the real current revision.
    const current = grants === 'all' ? shared : revisions.at(-1)?.id ?? null
    return { videoId, viewerId: actor.id, canApprove: Boolean(shared && grantFor(shared)?.can_approve), currentRevisionId: current, revisions: revisions.map(row => {
      const grant = grantFor(row.id)
      return {
        id: row.id, durationMs: row.duration_ms, reviewVersion: row.review_version, state: row.viewer_state,
        metadata: JSON.parse(row.metadata), createdAt: row.created_at,
        mediaUrl: `/api/review/media?videoId=${videoId}&revisionId=${row.id}`,
        ...(JSON.parse(row.metadata).thumbnailId ? { thumbnailUrl: `/api/review/thumbnail?videoId=${videoId}&revisionId=${row.id}` } : {}),
        ...(grant ? { canApprove: Boolean(grant.can_approve), expiresAt: grant.expires_at } : {}),
      }
    }), comments: commentRows, decisions, resolutions,
      ...(actor.role === 'staff' ? { grants: await this.access.grantsFor(videoId) } : {}),
    }
  }
  async execute(actor: ReviewActor, value: unknown, expected?: { currentRevisionId: string | null }) {
    const parsed = commandSchema.safeParse(value)
    if (!parsed.success) throw new ReviewError(400, 'Invalid review command')
    const input = parsed.data
    // Before the replay below, so a revoked or expired customer cannot read a stored result.
    await this.access.requireVideo(actor, input.videoId)
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
    await this.access.requireVideo(actor, input.videoId)
    const mutations: Statement[] = [], guards: Statement[] = []
    const at = this.access.now().toISOString()
    const resultId = input.commandId
    let result: Record<string, unknown> = { id: resultId, action: input.action }
    if (input.action === 'share' || input.action === 'revoke') {
      staff(actor)
      await this.dependencies.video(input.videoId, actor)
      const user = await this.store.one('SELECT id FROM users WHERE id=? AND role=?', input.userId, 'customer')
      if (!user) throw new ReviewError(400, 'Choose an existing customer account')
      if (input.action === 'share') {
        await this.access.require(actor, input.videoId, input.revisionId, 'manage')
        if ((input.expiresAt === undefined) === (input.expiresInDays === undefined)) throw new ReviewError(400, 'Choose either an expiry time or a number of days')
        // expiresInDays uses the server clock, so browser clock skew cannot push a share past the limit.
        const now = this.access.now().getTime(), expires = new Date(input.expiresAt ?? now + input.expiresInDays! * 86400000)
        if (!(expires.getTime() > now && expires.getTime() <= now + maximumGrantDays * 86400000)) throw new ReviewError(400, `Choose an expiry within ${maximumGrantDays} days`)
        mutations.push(this.access.shareStatement({ id: resultId, videoId: input.videoId, revisionId: input.revisionId, userId: input.userId, canApprove: input.canApprove, grantedBy: actor.id, at, expiresAt: expires.toISOString() }))
        result = { action: 'share', revisionId: input.revisionId, userId: input.userId, expiresAt: expires.toISOString() }
      } else {
        if (input.revisionId) await this.access.require(actor, input.videoId, input.revisionId, 'manage')
        mutations.push(this.access.revokeStatement({ videoId: input.videoId, userId: input.userId, revisionId: input.revisionId, by: actor.id, at }))
        result = { action: 'revoke', userId: input.userId, revisionId: input.revisionId ?? null }
      }
    } else if (input.action === 'create-revision') {
      staff(actor)
      if (expected && (state?.current_revision ?? null) !== expected.currentRevisionId) throw new ReviewError(409, 'A newer review revision is current; this processed cut was retained without replacing it')
      await this.dependencies.video(input.videoId, actor)
      if (input.mediaId === input.deliverableMediaId) throw new ReviewError(400, 'Keep the original private; upload a separate review deliverable')
      await this.dependencies.assertPair?.(input.videoId, input.mediaId, input.deliverableMediaId)
      const source = await this.dependencies.source(input.mediaId, actor, input.videoId)
      const deliverable = await this.dependencies.deliverable(input.deliverableMediaId, actor, input.videoId)
      if (input.durationMs !== undefined && input.durationMs !== deliverable.durationMs) throw new ReviewError(400, 'Duration does not match the verified deliverable')
      await this.validateThumbnail(input.videoId, input.metadata.thumbnailId)
      validateMetadata(input.metadata, deliverable.durationMs)
      mutations.push(sql('INSERT INTO video_revisions(id,video_id,media_id,checksum,deliverable_media_id,deliverable_checksum,duration_ms,review_version,state,metadata,created_by_id,created_at) VALUES(?,?,?,?,?,?,?,1,?,?,?,?)', resultId, input.videoId, input.mediaId, source.checksum, input.deliverableMediaId, deliverable.checksum, deliverable.durationMs, 'ready', JSON.stringify(input.metadata), actor.id, at))
      mutations.push(sql('UPDATE video_review_state SET current_revision=? WHERE video_id=?', resultId, input.videoId))
      result = { revisionId: resultId, reviewVersion: 1 }
    } else if (input.action === 'resolve-comment') {
      const comment = await this.store.one<{ author_id: number; revision_id: string }>('SELECT author_id,revision_id FROM review_comments WHERE id=? AND video_id=?', input.commentId, input.videoId)
      // A comment the caller cannot see is reported exactly like a missing one.
      if (!comment || !await this.access.canSeeComment(actor, comment)) throw new ReviewError(404, 'Comment not found')
      if (actor.role !== 'staff' && comment.author_id !== actor.id) throw new ReviewError(403, 'Only the author or staff can resolve this comment')
      await this.access.require(actor, input.videoId, comment.revision_id, 'comment')
      mutations.push(sql('INSERT INTO review_comment_resolutions(id,video_id,comment_id,actor_id,resolved,created_at) VALUES(?,?,?,?,?,?)', resultId, input.videoId, input.commentId, actor.id, input.resolved ? 1 : 0, at))
      mutations.push(sql('UPDATE review_comments SET resolved=?,resolved_by_id=?,resolved_at=? WHERE id=?', input.resolved ? 1 : 0, actor.id, at, input.commentId))
      result = { commentId: input.commentId, resolved: input.resolved }
    } else {
      const capability = input.action === 'comment' ? 'comment' : input.action === 'decide' ? 'decide' : 'manage'
      const { revision, grant } = await this.access.require(actor, input.videoId, input.revisionId, capability)
      if (input.action === 'comment') {
        if (input.startMs >= revision.duration_ms || (input.endMs !== undefined && (input.endMs < input.startMs || input.endMs > revision.duration_ms))) throw new ReviewError(400, 'Comment timestamps must be within this revision')
        mutations.push(sql('INSERT INTO review_comments(id,video_id,revision_id,author_id,start_ms,end_ms,body,resolved,created_at) VALUES(?,?,?,?,?,?,?,0,?)', resultId, input.videoId, revision.id, actor.id, input.startMs, input.endMs ?? null, input.body, at))
        result = { commentId: resultId }
      } else {
        const stale = state?.current_revision !== revision.id || revision.review_version !== input.expectedReviewVersion
        // Finality is per approver: a client is closed only by their own approval, and
        // learns nothing from another client's decision.
        if (actor.role === 'customer' && (stale || revision.state === 'published' || await this.access.ownState(revision.id, actor.id) === 'approved')) throw new ReviewError(409, signOffClosed)
        if (stale) throw new ReviewError(409, 'The current review revision changed')
        if (actor.role === 'staff' && input.action !== 'publish' && ['approved', 'published'].includes(revision.state)) throw new ReviewError(409, 'Approved revisions are final; create a new revision')
        if (input.action === 'edit') {
          if (input.metadata.thumbnailId !== (JSON.parse(revision.metadata) as ReviewMetadata).thumbnailId) throw new ReviewError(409, 'Create a new revision to change its thumbnail')
          await this.validateThumbnail(input.videoId, input.metadata.thumbnailId)
          validateMetadata(input.metadata, revision.duration_ms)
          mutations.push(sql('UPDATE video_revisions SET metadata=?,review_version=review_version+1,state=?,decision_id=NULL WHERE id=?', JSON.stringify(input.metadata), 'ready', revision.id))
          result = { revisionId: revision.id, reviewVersion: revision.review_version + 1 }
        } else if (input.action === 'decide') {
          if (actor.role !== 'customer' || !grant?.can_approve) throw new ReviewError(403, 'An assigned client approver must make this decision')
          // The decision pins the exact bytes it approved and the grant that allowed it.
          mutations.push(sql('INSERT INTO review_decisions(id,video_id,revision_id,author_id,review_version,grant_version,decision,note,created_at,deliverable_checksum,source_checksum,grant_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', resultId, input.videoId, revision.id, actor.id, revision.review_version, grant.version, input.decision, input.note, at, revision.deliverable_checksum, revision.checksum, grant.id))
          guards.push(this.access.grantGuard(grant.id, grant.version))
          // The stored state keeps the first approval: approved revisions are immutable. Staff
          // and publication read the combined outcome of every approver's latest decision.
          mutations.push(sql("UPDATE video_revisions SET state=?,decision_id=? WHERE id=? AND state NOT IN ('approved','published')", input.decision, resultId, revision.id))
          result = { decisionId: resultId, decision: input.decision }
        } else {
          const decision = await this.store.one<Decision>('SELECT * FROM review_decisions WHERE id=? AND video_id=?', input.decisionId, input.videoId)
          if (!decision || revision.state !== 'approved' || decision.decision !== 'approved' || decision.revision_id !== revision.id || decision.review_version !== revision.review_version || !await this.access.isLatestDecision(revision.id, decision.id)) throw new ReviewError(409, 'Current client approval is required')
          if (await this.access.teamState(revision.id) === 'changes-requested') throw new ReviewError(409, 'An assigned client approver has requested changes on this revision')
          if (await this.store.one('SELECT id FROM review_comments WHERE revision_id=? AND resolved=0 LIMIT 1', revision.id)) throw new ReviewError(409, 'Resolve all comments on this revision before publication')
          if (decision.deliverable_checksum !== revision.deliverable_checksum || decision.source_checksum !== revision.checksum) throw new ReviewError(409, 'Approval does not match this revision')
          // Revocation or a can_approve change voids the approval. Expiry alone does not:
          // the client approved while their access was valid.
          const approvalGrant = await this.access.approvalGrant(decision.grant_id)
          if (!approvalGrant || approvalGrant.revision_id !== revision.id || approvalGrant.user_id !== decision.author_id || approvalGrant.revoked_at !== null || approvalGrant.version !== decision.grant_version || !approvalGrant.can_approve) throw new ReviewError(409, 'The approval grant changed; a new revision and decision are required')
          if ((await this.dependencies.source(revision.media_id, actor, input.videoId)).checksum !== revision.checksum) throw new ReviewError(409, 'Source bytes changed since review')
          if ((await this.dependencies.deliverable(revision.deliverable_media_id, actor, input.videoId)).checksum !== revision.deliverable_checksum) throw new ReviewError(409, 'Deliverable bytes changed since review')
          const release = await this.dependencies.stageRelease(input.videoId, resultId, revision.deliverable_media_id, revision.deliverable_checksum, actor)
          if (release.checksum !== revision.deliverable_checksum || release.checksum !== decision.deliverable_checksum) throw new ReviewError(409, 'Release does not match the approved deliverable')
          const video = await this.dependencies.video(input.videoId, actor)
          mutations.push(sql('INSERT INTO video_publications(id,document) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document', input.videoId, JSON.stringify(publicProjection(video, revision, at, release.publicUrl ?? this.dependencies.publicMediaUrl(input.videoId, resultId)))))
          mutations.push(sql('UPDATE video_revisions SET state=? WHERE id=?', 'published', revision.id))
          mutations.push(sql('INSERT INTO review_publication_events(id,video_id,revision_id,decision_id,published_by_id,published_at,object_key,object_etag,checksum,bytes,content_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)', resultId, input.videoId, revision.id, decision.id, actor.id, at, release.key, release.etag, release.checksum, release.bytes, release.contentType))
          result = { publicationId: resultId, revisionId: revision.id, publishedAt: at }
        }
      }
    }
    if (!state && !['create-revision', 'share', 'revoke'].includes(input.action)) throw new ReviewError(404, 'Review not found')
    await this.store.commit(input.videoId, state?.generation ?? null, mutations, { id: input.commandId, actor: actor.id, hash: inputHash, result }, guards)
    return result
  }
}
