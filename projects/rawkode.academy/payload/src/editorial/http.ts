import { MachineAuthError, verifyMachineRequest, type SecretSource } from '../machine-auth'
import { ReviewError, type ReviewActor } from '../review/contracts'
import { readCommand, reviewFailure, videoIdFrom } from '../review/http'
import { machineActions } from './contracts'
import type { EditorialTimes } from './times'

const privateHeaders = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' }
// The fixed route path both sides sign (src/machine-auth.ts). Studio sends
// broadcast-started and broadcast-ended here over its PAYLOAD service binding.
export const EDITORIAL_BROADCAST_PATH = '/api/editorial/broadcast'
const isMachineAction = (action: unknown) => (machineActions as readonly unknown[]).includes(action)
function failure(error: unknown) {
  if (error instanceof MachineAuthError) return Response.json({ error: error.message }, { status: error.status, headers: privateHeaders })
  return reviewFailure(error)
}

// Staff session routes behind the admin UI. Not on the website bridge allowlist,
// so preview.rawkode.academy can never reach them.
export function createEditorialHandlers(runtime: (request: Request) => Promise<{ times: EditorialTimes; actor: ReviewActor; origin: string }>) {
  return {
    async GET(request: Request) {
      try {
        const { times, actor } = await runtime(request)
        if (actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
        return Response.json(await times.read(videoIdFrom(request)), { headers: privateHeaders })
      } catch (error) { return failure(error) }
    },
    async POST(request: Request) {
      try {
        const { times, actor, origin } = await runtime(request)
        if (actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
        if (request.headers.get('origin') !== origin) throw new ReviewError(403, 'Untrusted request origin')
        if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ReviewError(415, 'Use application/json')
        const command = await readCommand(request) as { action?: unknown } | null
        // Broadcast times come from Studio's signed machine route; staff use correct.
        if (isMachineAction(command?.action)) throw new ReviewError(400, 'Broadcast times are recorded by Studio; correct them instead')
        return Response.json(await times.execute({ kind: 'user', id: actor.id, role: actor.role }, command), { headers: privateHeaders })
      } catch (error) { return failure(error) }
    },
  }
}

// Machine route for Rawkode Studio. Cookie-less and outside OIDC: the only
// credential is the src/machine-auth.ts signature, checked before any work. The
// signed Idempotency-Key must equal the commandId, so a replay inside the skew
// window returns the journaled result and never applies a second effect.
export function createEditorialMachineHandlers(options: { secret: () => SecretSource | null | undefined; runtime: () => Promise<{ times: EditorialTimes }>; now?: () => number }) {
  return {
    async POST(request: Request) {
      try {
        const verified = await verifyMachineRequest(request, { path: EDITORIAL_BROADCAST_PATH, principal: 'rawkode-studio', secret: options.secret(), now: options.now })
        if (request.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'application/json') throw new ReviewError(415, 'Use application/json')
        const command = verified.json() as { action?: unknown; commandId?: unknown } | null
        if (!command || !isMachineAction(command.action)) throw new ReviewError(400, 'Only broadcast-started and broadcast-ended are accepted')
        if (command.commandId !== verified.idempotencyKey) throw new ReviewError(400, 'Idempotency-Key must equal the commandId')
        const { times } = await options.runtime()
        return Response.json(await times.execute({ kind: 'machine', name: 'studio' }, command), { headers: privateHeaders })
      } catch (error) { return failure(error) }
    },
  }
}
