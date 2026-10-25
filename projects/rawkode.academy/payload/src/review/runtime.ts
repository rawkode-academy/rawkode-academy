import config from '@payload-config'
import { getPayload } from 'payload'
import { cloudflare } from '../cloudflare'
import { authConfig } from '../auth/config'
import { ReviewError, type ReviewActor } from './contracts'
import { publishedMediaUrl, reviewRequestActor } from './host'
import { ReviewStore } from './store'
import { ReviewService } from './service'
import { ReviewIntake } from './intake'
import { assertThumbnail } from './thumbnails'
import { configuredMediaAdapter } from './processing-runtime'
import { TrustedAssets, assetObject } from './intake-storage'
import { boundedObject, stageReleaseObject, verifiedDeliverable } from './artifacts'
import { readOnlyStudioContent, type StudioBindings } from './studio-content'
import { StudioAssets, StudioHandoff, listPendingStudioAdoptions, studioStageRelease } from './studio-handoff'
import { ensureMachineActor } from '../machine-auth'

export function studioBindings() { return cloudflare.env as unknown as StudioBindings }

export async function reviewBackend() {
  const payload = await getPayload({ config })
  const store = new ReviewStore(cloudflare.env.D1)
  const auth = authConfig(cloudflare.env)
  const fixtureEnabled = (cloudflare.env as CloudflareEnv & { POC_REVIEW_FIXTURE_MEDIA?: string }).POC_REVIEW_FIXTURE_MEDIA === 'true'
  const assets = new TrustedAssets(store, cloudflare.env.R2)
  const studioContent = studioBindings().STUDIO_CONTENT ? readOnlyStudioContent(studioBindings().STUDIO_CONTENT!) : null
  const studioAssets = studioContent ? new StudioAssets(store, studioContent) : null
  const fixtureSource = async (mediaId: number, actor: ReviewActor) => {
    const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: false, user: actor })
    return boundedObject(cloudflare.env.R2, String(media.filename))
  }
  const service = new ReviewService(store, {
    async video(id, actor) {
      const video = await payload.findByID({ collection: 'videos', id, depth: 0, draft: true, overrideAccess: false, user: actor })
      if (video.tombstone || video.processingRun) throw new ReviewError(409, 'Choose a video outside the legacy pipeline')
      return video as { id: number; legacyId: string }
    },
    thumbnail: async (videoId, thumbnailId) => { await assertThumbnail(store, videoId, thumbnailId) },
    async assertPair(videoId, sourceId, deliverableId) {
      if (await studioAssets?.pair(videoId, sourceId, deliverableId)) return
      await assets.pair(videoId, sourceId, deliverableId)
    },
    async source(mediaId, actor, videoId) {
      const studio = await studioAssets?.resolve(mediaId, videoId, 'source')
      if (studio) return { checksum: studio.checksum }
      const asset = await assets.resolve(mediaId, videoId, 'source')
      return asset ? { checksum: asset.checksum } : fixtureSource(mediaId, actor)
    },
    async deliverable(mediaId, actor, videoId) {
      const studio = await studioAssets?.resolve(mediaId, videoId, 'deliverable')
      if (studio) return { checksum: studio.checksum, durationMs: studio.duration_ms!, contentType: studio.content_type }
      const asset = await assets.resolve(mediaId, videoId, 'deliverable')
      return asset ? { checksum: asset.checksum, durationMs: asset.duration_ms!, contentType: asset.content_type } : verifiedDeliverable((await fixtureSource(mediaId, actor)).checksum, auth.local, fixtureEnabled)
    },
    async stageRelease(videoId, publicationId, mediaId, checksum, actor) {
      const studio = studioAssets && await studioStageRelease(studioAssets, videoId, mediaId, checksum)
      if (studio) return studio
      const asset = await assets.resolve(mediaId, videoId, 'deliverable')
      if (asset) {
        if (asset.checksum !== checksum) throw new ReviewError(409, 'Deliverable changed since approval')
        // Retain the already immutable, attested object; publication records its
        // exact key/ETag/digest. No full-buffer copy or mutable public alias.
        return { ...assetObject(asset), contentType: asset.content_type }
      }
      const content = await fixtureSource(mediaId, actor)
      const probe = verifiedDeliverable(content.checksum, auth.local, fixtureEnabled)
      if (content.checksum !== checksum) throw new ReviewError(409, 'Deliverable changed since approval')
      return stageReleaseObject(cloudflare.env.R2, `review-releases/${videoId}/${publicationId}/${checksum}.mp4`, content.bytes, checksum, probe.contentType)
    },
    publicMediaUrl: publishedMediaUrl(auth),
    now: () => new Date(),
  })
  const intake = new ReviewIntake(store, cloudflare.env.R2, service, configuredMediaAdapter(cloudflare.env, store))
  const publicationAvailable = async (videoId: number) => (auth.local && fixtureEnabled) || Boolean(await store.one(
    `SELECT a.media_id FROM video_review_state s JOIN video_revisions r ON r.id=s.current_revision JOIN review_intake_assets a ON a.media_id=r.deliverable_media_id AND a.video_id=s.video_id AND a.kind=? WHERE s.video_id=?
     UNION ALL SELECT a.media_id FROM video_review_state s JOIN video_revisions r ON r.id=s.current_revision JOIN review_studio_assets a ON a.media_id=r.deliverable_media_id AND a.video_id=s.video_id AND a.kind=? WHERE s.video_id=? AND ?`,
    'deliverable', videoId, 'deliverable', videoId, studioAssets ? 1 : 0))
  return { payload, store, service, intake, assets, studioAssets, studioContent, auth, publicationAvailable, bucket: cloudflare.env.R2 }
}
export async function reviewRuntime(request: Request) {
  const backend = await reviewBackend()
  const { user } = await backend.payload.auth({ headers: request.headers })
  return { ...backend, ...reviewRequestActor(request.headers, backend.auth, user) }
}
// Call only after a revision grant has been checked. Public delivery uses a
// committed release object key and never resolves an upload filename.
export async function deliveryKey(payload: Awaited<ReturnType<typeof getPayload>>, mediaId: number) {
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true })
  return String(media.filename)
}

// Machine endpoints only. Resolves the Studio system principal and the handoff over
// the read-only content facade. Callers must check studioBindings() first.
export async function studioHandoffRuntime() {
  const backend = await reviewBackend()
  const { STUDIO_CONTENT_BUCKET_NAME } = studioBindings()
  if (!backend.studioContent || !STUDIO_CONTENT_BUCKET_NAME) throw new ReviewError(503, 'Studio handoff not configured')
  const actor = await ensureMachineActor(backend.payload, 'rawkode-studio')
  const resolveVideo = async (legacyId: string, user: ReviewActor) => {
    const result = await backend.payload.find({ collection: 'videos', where: { legacyId: { equals: legacyId } }, depth: 0, draft: true, limit: 1, overrideAccess: false, user })
    const video = result.docs[0]
    if (!video) throw new ReviewError(404, 'No Payload video has this legacy ID')
    if (video.tombstone || video.processingRun) throw new ReviewError(409, 'Choose a video outside the legacy pipeline')
    return { id: Number(video.id), legacyId: String(video.legacyId), title: video.title, description: video.description }
  }
  return { ...backend, actor, handoff: new StudioHandoff(backend.store, backend.studioContent, backend.service, resolveVideo, actor, STUDIO_CONTENT_BUCKET_NAME) }
}
// Listing needs no machine principal: it reads adoption rows for a staff caller.
export function studioPendingList(backend: Pick<Awaited<ReturnType<typeof reviewBackend>>, 'store' | 'studioContent'>) {
  return backend.studioContent ? { listPending: (limit?: number) => listPendingStudioAdoptions(backend.store, limit) } : null
}
