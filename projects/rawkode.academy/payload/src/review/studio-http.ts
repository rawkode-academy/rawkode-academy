import { MachineAuthError, verifyMachineRequest } from '../machine-auth'
import { ReviewError, type ReviewActor } from './contracts'
import { reviewFailure } from './http'
import { studioHandoffConfigured, type StudioBindings } from './studio-content'
import { STUDIO_HANDOFF_PATH } from './studio-contracts'
import type { StudioHandoff } from './studio-handoff'

const privateHeaders = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' }
function failure(error: unknown) {
  if (error instanceof MachineAuthError) return Response.json({ error: error.message }, { status: error.status, headers: privateHeaders })
  return reviewFailure(error)
}

// Machine endpoint for Rawkode Studio. Cookie-less and outside OIDC: the only
// credential is the src/machine-auth.ts signature, checked before any work.
export function createStudioHandoffHandlers(options: { bindings: () => StudioBindings; runtime: () => Promise<{ handoff: StudioHandoff }>; now?: () => number }) {
  async function handle(request: Request) {
    try {
      const bindings = options.bindings()
      if (!studioHandoffConfigured(bindings)) throw new MachineAuthError(503, 'Studio handoff not configured')
      const verified = await verifyMachineRequest(request, { path: STUDIO_HANDOFF_PATH, principal: 'rawkode-studio', secret: bindings.STUDIO_MACHINE_SECRET, now: options.now })
      if (request.method === 'POST') {
        if (request.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'application/json') throw new ReviewError(415, 'Use application/json')
        const body = verified.json() as { idempotencyKey?: unknown } | null
        // The signed Idempotency-Key is the adoption key, so a replay is the same adoption.
        if (!body || body.idempotencyKey !== verified.idempotencyKey) throw new ReviewError(400, 'Idempotency-Key must equal the adoption idempotencyKey')
        const { handoff } = await options.runtime()
        return Response.json(await handoff.adopt(body), { headers: privateHeaders })
      }
      const { handoff } = await options.runtime()
      return Response.json(await handoff.status(Object.fromEntries(new URL(request.url).searchParams)), { headers: privateHeaders })
    } catch (error) { return failure(error) }
  }
  return { GET: handle, POST: handle }
}

// Staff-only listing of adoptions that are failed, stuck or attached without a publication.
export function createStudioAdoptionListHandlers(runtime: (request: Request) => Promise<{ actor: ReviewActor; handoff: Pick<StudioHandoff, 'listPending'> | null }>) {
  return {
    async GET(request: Request) {
      try {
        const { actor, handoff } = await runtime(request)
        if (actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
        if (!handoff) throw new ReviewError(503, 'Studio handoff not configured')
        return Response.json({ adoptions: await handoff.listPending(50) }, { headers: privateHeaders })
      } catch (error) { return failure(error) }
    },
  }
}
