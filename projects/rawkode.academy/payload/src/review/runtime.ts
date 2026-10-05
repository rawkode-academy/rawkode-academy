import config from '@payload-config'
import { getPayload } from 'payload'
import { cloudflare } from '../cloudflare'
import { authConfig } from '../auth/config'
import { actorFromUser, ReviewError, type ReviewActor } from './contracts'
import { ReviewStore } from './store'
import { ReviewService } from './service'
import { boundedObject, stageReleaseObject, verifiedDeliverable } from './artifacts'

export async function reviewBackend() {
  const payload = await getPayload({ config })
  const store = new ReviewStore(cloudflare.env.D1)
  const auth = authConfig(cloudflare.env)
  const fixtureEnabled = (cloudflare.env as CloudflareEnv & { POC_REVIEW_FIXTURE_MEDIA?: string }).POC_REVIEW_FIXTURE_MEDIA === 'true'
  const source = async (mediaId: number, actor: ReviewActor) => {
    const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: false, user: actor })
    return boundedObject(cloudflare.env.R2, String(media.filename))
  }
  const service = new ReviewService(store, {
    async video(id, actor) {
      const video = await payload.findByID({ collection: 'videos', id, depth: 0, draft: true, overrideAccess: false, user: actor })
      if (video.tombstone || video.processingRun) throw new ReviewError(409, 'Choose a video outside the legacy pipeline')
      return video as { id: number; legacyId: string }
    },
    source,
    async deliverable(mediaId, actor) {
      return verifiedDeliverable((await source(mediaId, actor)).checksum, auth.local, fixtureEnabled)
    },
    async stageRelease(videoId, publicationId, mediaId, checksum, actor) {
      const content = await source(mediaId, actor)
      const probe = verifiedDeliverable(content.checksum, auth.local, fixtureEnabled)
      if (content.checksum !== checksum) throw new ReviewError(409, 'Deliverable changed since approval')
      return stageReleaseObject(cloudflare.env.R2, `review-releases/${videoId}/${publicationId}/${checksum}.mp4`, content.bytes, checksum, probe.contentType)
    },
    publicMediaUrl: (videoId, publicationId) => `${auth.origin}/api/review/published-media?videoId=${videoId}&publicationId=${publicationId}`,
  })
  return { payload, store, service, origin: auth.origin, publicationAvailable: auth.local && fixtureEnabled, bucket: cloudflare.env.R2 }
}
export async function reviewRuntime(request: Request) {
  const backend = await reviewBackend()
  const { user } = await backend.payload.auth({ headers: request.headers })
  return { ...backend, actor: actorFromUser(user) }
}
// Call only after a revision grant has been checked. Public delivery uses a
// committed release object key and never resolves an upload filename.
export async function deliveryKey(payload: Awaited<ReturnType<typeof getPayload>>, mediaId: number) {
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true })
  return String(media.filename)
}
