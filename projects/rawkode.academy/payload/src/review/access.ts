import { ReviewError, type ReviewActor } from './contracts'
import type { ReviewStore, Statement } from './store'

// The single enforcement point for revision grants. Every review read, mutation,
// media byte, thumbnail and export goes through ReviewAccess, and no other review
// module names the grant table.
export type Revision = { id: string; video_id: string; media_id: string; deliverable_media_id: string; deliverable_checksum: string; checksum: string; duration_ms: number; review_version: number; state: string; metadata: string; decision_id: string | null; created_by_id: string; created_at: string }
export type Capability = 'view' | 'comment' | 'decide' | 'export' | 'manage'
export type RevisionGrant = { id: string; video_id: string; revision_id: string; user_id: string; can_approve: number; version: number; expires_at: string; revoked_at: string | null }
export type ReviewListRow = { videoId: string; revisionId: string; metadata: string; state: string; reviewVersion: number }
const active = (alias: string) => `${alias}.revoked_at IS NULL AND ${alias}.expires_at>?`
// Each author's latest decision on the revision's current review version. rowid
// orders decisions recorded within the same millisecond.
const latestDecisions = (revision: string) => `FROM review_decisions d WHERE d.revision_id=${revision}.id AND d.review_version=${revision}.review_version AND NOT EXISTS(SELECT 1 FROM review_decisions n WHERE n.revision_id=d.revision_id AND n.author_id=d.author_id AND n.review_version=d.review_version AND n.rowid>d.rowid)`
const approverGrant = 'SELECT 1 FROM review_revision_grants g WHERE g.revision_id=d.revision_id AND g.user_id=d.author_id AND g.can_approve=1 AND g.revoked_at IS NULL'
// Staff see the combined outcome: one active approver's open change request outweighs
// another approver's approval, and an approval counts only while its grant is unchanged.
const teamState = (revision: string) => `CASE WHEN ${revision}.state='published' THEN 'published'
  WHEN EXISTS(SELECT 1 ${latestDecisions(revision)} AND d.decision='changes-requested' AND EXISTS(${approverGrant})) THEN 'changes-requested'
  WHEN EXISTS(SELECT 1 ${latestDecisions(revision)} AND d.decision='approved' AND EXISTS(${approverGrant} AND g.id=d.grant_id AND g.version=d.grant_version)) THEN 'approved'
  ELSE 'ready' END`
// Customers see the outcome of their own latest decision only, so one client never
// learns whether another client approved or requested changes. Publication is public.
const ownState = (revision: string) => `CASE WHEN ${revision}.state='published' THEN 'published' ELSE COALESCE((SELECT d.decision FROM review_decisions d WHERE d.revision_id=${revision}.id AND d.author_id=? AND d.review_version=${revision}.review_version ORDER BY d.rowid DESC LIMIT 1),'ready') END`

export class ReviewAccess {
  constructor(readonly store: ReviewStore, readonly now: () => Date = () => new Date()) {}
  private at() { return this.now().toISOString() }
  activeGrant(revisionId: string, userId: string) {
    return this.store.one<RevisionGrant>(`SELECT * FROM review_revision_grants g WHERE g.revision_id=? AND g.user_id=? AND ${active('g')}`, revisionId, userId, this.at())
  }
  async require(actor: ReviewActor, videoId: string, revisionId: string, capability: Capability): Promise<{ revision: Revision; grant: RevisionGrant | null }> {
    if (capability === 'manage' && actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
    const revision = await this.store.one<Revision>('SELECT * FROM video_revisions WHERE id=? AND video_id=?', revisionId, videoId)
    if (!revision) throw new ReviewError(404, 'Revision not found')
    if (actor.role === 'staff') return { revision, grant: null }
    const grant = actor.role === 'customer' ? await this.activeGrant(revisionId, actor.id) : null
    // A missing, expired, revoked or other-revision grant is indistinguishable from a missing revision.
    if (!grant) throw new ReviewError(404, 'Revision not found')
    if (capability === 'decide' && !grant.can_approve) throw new ReviewError(403, 'An assigned client approver must make this decision')
    return { revision, grant }
  }
  async requireVideo(actor: ReviewActor, videoId: string) {
    if (actor.role === 'staff') return
    if (!await this.store.one(`SELECT 1 AS found FROM review_revision_grants g WHERE g.video_id=? AND g.user_id=? AND ${active('g')} LIMIT 1`, videoId, actor.id, this.at())) throw new ReviewError(404, 'Review not found')
  }
  async visibleGrants(actor: ReviewActor, videoId: string): Promise<RevisionGrant[] | 'all'> {
    if (actor.role === 'staff') return 'all'
    return this.store.all<RevisionGrant>(`SELECT * FROM review_revision_grants g WHERE g.video_id=? AND g.user_id=? AND ${active('g')} ORDER BY g.revision_id`, videoId, actor.id, this.at())
  }
  // Customers see their own comments and staff comments, never another customer's.
  commentFilter(actor: ReviewActor, alias = 'c'): Statement {
    if (actor.role === 'staff') return { sql: '', values: [] }
    return { sql: ` AND (${alias}.author_id=? OR ${alias}.author_id IN (SELECT id FROM users WHERE role='staff'))`, values: [actor.id] }
  }
  async canSeeComment(actor: ReviewActor, comment: { author_id: string; revision_id: string }) {
    if (actor.role === 'staff') return true
    if (!await this.activeGrant(comment.revision_id, actor.id)) return false
    return comment.author_id === actor.id || Boolean(await this.store.one("SELECT id FROM users WHERE id=? AND role='staff'", comment.author_id))
  }
  // The revision state this viewer may see, as a column over a video_revisions alias.
  stateColumn(actor: ReviewActor, alias = 'r'): Statement {
    return actor.role === 'staff' ? { sql: teamState(alias), values: [] } : { sql: ownState(alias), values: [actor.id] }
  }
  async teamState(revisionId: string) {
    return (await this.store.one<{ state: string }>(`SELECT ${teamState('r')} AS state FROM video_revisions r WHERE r.id=?`, revisionId))?.state ?? 'ready'
  }
  async ownState(revisionId: string, userId: string) {
    return (await this.store.one<{ state: string }>(`SELECT ${ownState('r')} AS state FROM video_revisions r WHERE r.id=?`, userId, revisionId))?.state ?? 'ready'
  }
  // Whether this decision is still its author's latest on the revision's current version.
  async isLatestDecision(revisionId: string, decisionId: string) {
    return Boolean(await this.store.one(`SELECT 1 AS found FROM video_revisions r WHERE r.id=? AND EXISTS(SELECT 1 ${latestDecisions('r')} AND d.id=?)`, revisionId, decisionId))
  }
  listVisible(actor: ReviewActor, after: string | null) {
    if (actor.role === 'staff') return this.store.all<ReviewListRow>(
      `SELECT s.video_id AS videoId,r.id AS revisionId,r.metadata,${teamState('r')} AS state,r.review_version AS reviewVersion
       FROM video_review_state s JOIN video_revisions r ON r.id=s.current_revision
       WHERE s.video_id>? ORDER BY s.video_id LIMIT 51`, after)
    const at = this.at()
    // One row per video: the caller's newest shared revision, with a deterministic tie-break.
    return this.store.all<ReviewListRow>(
      `SELECT g.video_id AS videoId,r.id AS revisionId,r.metadata,${ownState('r')} AS state,r.review_version AS reviewVersion
       FROM (SELECT DISTINCT video_id FROM review_revision_grants WHERE user_id=? AND revoked_at IS NULL AND expires_at>? AND video_id>?) g
       JOIN video_revisions r ON r.id=(SELECT g2.revision_id FROM review_revision_grants g2 JOIN video_revisions r2 ON r2.id=g2.revision_id
         WHERE g2.video_id=g.video_id AND g2.user_id=? AND ${active('g2')} ORDER BY r2.created_at DESC,r2.id DESC LIMIT 1)
       ORDER BY g.video_id LIMIT 51`, actor.id, actor.id, at, after, actor.id, at)
  }
  // Distinct customers holding an unrevoked, unexpired grant on any revision of
  // the video. The fragment binds one parameter: the current timestamp.
  activeReviewersSubquery(videoColumn: string): { sql: string; params: [string] } {
    return { sql: `(SELECT COUNT(DISTINCT g.user_id) FROM review_revision_grants g WHERE g.video_id=${videoColumn} AND ${active('g')})`, params: [this.at()] }
  }
  async activeReviewerCount(videoId: string) {
    const row = await this.store.one<{ total: number }>(`SELECT COUNT(DISTINCT g.user_id) AS total FROM review_revision_grants g WHERE g.video_id=? AND ${active('g')}`, videoId, this.at())
    return Number(row?.total ?? 0)
  }
  async grantsFor(videoId: string) {
    const rows = await this.store.all<{ revisionId: string; userId: string; canApprove: number; version: number; expiresAt: string; revokedAt: string | null }>(
      'SELECT revision_id AS revisionId,user_id AS userId,can_approve AS canApprove,version,expires_at AS expiresAt,revoked_at AS revokedAt FROM review_revision_grants WHERE video_id=? ORDER BY revision_id,user_id', videoId)
    return rows.map(row => ({ ...row, canApprove: Boolean(row.canApprove) }))
  }
  approvalGrant(grantId: string | null) {
    return grantId ? this.store.one<RevisionGrant>('SELECT * FROM review_revision_grants WHERE id=?', grantId) : Promise.resolve(null)
  }
  // Extending expiry keeps the version so a recorded approval stays publishable; a
  // can_approve change or a re-share after revocation bumps it and voids the approval.
  shareStatement(input: { id: string; videoId: string; revisionId: string; userId: string; canApprove: boolean; grantedBy: string; at: string; expiresAt: string }): Statement {
    return { sql: `INSERT INTO review_revision_grants(id,video_id,revision_id,user_id,can_approve,version,granted_by_id,granted_at,expires_at) VALUES(?,?,?,?,?,1,?,?,?)
      ON CONFLICT(revision_id,user_id) DO UPDATE SET
        version=CASE WHEN review_revision_grants.revoked_at IS NOT NULL OR review_revision_grants.can_approve<>excluded.can_approve THEN review_revision_grants.version+1 ELSE review_revision_grants.version END,
        can_approve=excluded.can_approve,granted_by_id=excluded.granted_by_id,granted_at=excluded.granted_at,expires_at=excluded.expires_at,revoked_at=NULL,revoked_by_id=NULL`,
    values: [input.id, input.videoId, input.revisionId, input.userId, input.canApprove ? 1 : 0, input.grantedBy, input.at, input.expiresAt] }
  }
  revokeStatement(input: { videoId: string; userId: string; revisionId?: string; by: string; at: string }): Statement {
    const revision = input.revisionId ? ' AND revision_id=?' : ''
    return { sql: `UPDATE review_revision_grants SET revoked_at=?,revoked_by_id=?,version=version+1 WHERE video_id=? AND user_id=? AND revoked_at IS NULL${revision}`,
      values: [input.at, input.by, input.videoId, input.userId, ...(input.revisionId ? [input.revisionId] : [])] }
  }
  // An expression for ReviewStore.commit guards: the approving grant must still be
  // unchanged and active when the batch commits.
  grantGuard(grantId: string, version: number): Statement {
    return { sql: "CASE WHEN EXISTS(SELECT 1 FROM review_revision_grants WHERE id=? AND version=? AND can_approve=1 AND revoked_at IS NULL AND expires_at>max(?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))) THEN 1 ELSE 0 END", values: [grantId, version, this.at()] }
  }
}
