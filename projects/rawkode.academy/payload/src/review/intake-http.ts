import { ReviewError, type ReviewActor } from './contracts'
import { readCommand, reviewFailure } from './http'
import type { ReviewIntake } from './intake'

type Runtime = { intake: ReviewIntake; actor: ReviewActor; origin: string }
export function createIntakeHandlers(runtime: (request: Request) => Promise<Runtime>) {
  async function handle(request: Request) {
    try {
      const { intake, actor, origin } = await runtime(request)
      if (request.method !== 'GET' && request.headers.get('origin') !== origin) throw new ReviewError(403, 'Untrusted request origin')
      if (actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
      const id = new URL(request.url).searchParams.get('sessionId') ?? ''
      let result: unknown
      if (request.method === 'GET') result = await intake.read(actor, id)
      else if (request.method === 'PUT') result = await intake.upload(actor, id, request)
      else {
        if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ReviewError(415, 'Use application/json')
        result = await intake.execute(actor, await readCommand(request))
      }
      return Response.json(result, { headers: { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' } })
    } catch (error) { return reviewFailure(error) }
  }
  return { GET: handle, POST: handle, PUT: handle }
}
