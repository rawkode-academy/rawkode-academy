import type { AuthConfig } from '../auth/config'
import { isStaff } from '../auth/access'
import { requestOrigin } from '../auth/origin'
import { actorFromUser, ReviewError, type ReviewActor } from './contracts'
// When a bridge origin exists (production: preview.rawkode.academy), customers review
// only through it: on a direct origin (admin.rawkode.academy) the review API is staff
// only, and anyone else gets the same 404 as an unknown route. A config with no bridge
// (the pr-local Worker Preview, loopback development) keeps the customer flow on its
// direct origin, because it has nowhere else to go.
export function reviewRequestActor(headers: Headers, auth: AuthConfig, user: unknown): { origin: string; actor: ReviewActor } {
  const origin = requestOrigin(headers, auth)
  if (!origin) throw new ReviewError(403, 'Untrusted request origin')
  const staffOnly = auth.bridgeOrigins.length > 0 && auth.directOrigins.includes(origin)
  if (staffOnly && !isStaff(user)) throw new ReviewError(404, 'Not found')
  return { origin, actor: actorFromUser(user) }
}
// Canonical and host independent: persisted publication documents never depend on
// which host (admin or preview) ran the publish command.
export function publishedMediaUrl(auth: Pick<AuthConfig, 'publicMediaOrigin'>) {
  return (videoId: string, publicationId: string) => `${auth.publicMediaOrigin}/api/review/published-media?videoId=${encodeURIComponent(videoId)}&publicationId=${encodeURIComponent(publicationId)}`
}
