import { cloudflare } from '../cloudflare'
import { reviewRequestActor } from '../review/host'
import { reviewBackend, studioBindings } from '../review/runtime'
import { ReviewStore } from '../review/store'
import { EditorialTimes } from './times'

// Staff session: the same host and actor rules as the review API.
export async function editorialRuntime(request: Request) {
  const backend = await reviewBackend()
  const { user } = await backend.payload.auth({ headers: request.headers })
  return { times: new EditorialTimes(backend.store), ...reviewRequestActor(request.headers, backend.auth, user) }
}

// Machine route: no Payload session and no Payload boot. The shared Studio machine
// secret is bound in production only, so previews answer 503.
export const editorialMachineSecret = () => studioBindings().STUDIO_MACHINE_SECRET
export async function editorialMachineRuntime() {
  return { times: new EditorialTimes(new ReviewStore(cloudflare.env.D1)) }
}
