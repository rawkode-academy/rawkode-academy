import type { ReviewStore } from './store'

// Whether the current revision's deliverable is a trusted object that publish can
// release: an attested intake asset, or (when the Studio content binding exists) an
// adopted Studio asset. Local fixture media is always publishable in loopback dev.
export function publicationAvailability(store: ReviewStore, options: { fixture: boolean; studio: boolean }) {
  return async (videoId: number) => options.fixture || Boolean(await store.one(
    `SELECT a.media_id FROM video_review_state s JOIN video_revisions r ON r.id=s.current_revision JOIN review_intake_assets a ON a.media_id=r.deliverable_media_id AND a.video_id=s.video_id AND a.kind=? WHERE s.video_id=?
     UNION ALL SELECT a.media_id FROM video_review_state s JOIN video_revisions r ON r.id=s.current_revision JOIN review_studio_assets a ON a.media_id=r.deliverable_media_id AND a.video_id=s.video_id AND a.kind=? WHERE s.video_id=? AND ?`,
    'deliverable', videoId, 'deliverable', videoId, options.studio ? 1 : 0))
}
