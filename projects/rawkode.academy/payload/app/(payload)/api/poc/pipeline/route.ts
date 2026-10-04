import {oidcCsrfFailure} from '../../../../../src/auth/guard'
import {isStaff} from '../../../../../src/auth/access'
import config from '@payload-config'
import { getPayload } from 'payload'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { registerPipeline, startPipeline, editPipelineReview, approvePipeline } from '../../../../../src/pipeline'

export async function POST(request: Request) {
  const csrfFailure=await oidcCsrfFailure(request);if(csrfFailure)return csrfFailure
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!isStaff(user)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const input = await request.json() as { action: string; videoId: number; mediaId: number; checksum: string; videoVersion: string; runId: number; generatedRevision: string; summary: string; injectFailure?: boolean }
    if (input.action === 'register') {
      const run = await registerPipeline(payload, user, input)
      const { env } = await getCloudflareContext({ async: true })
      return Response.json(await startPipeline(payload, user, env, run.id, input.injectFailure))
    }
    if (input.action === 'resume') {
      const { env } = await getCloudflareContext({ async: true })
      return Response.json(await startPipeline(payload, user, env, input.runId, input.injectFailure))
    }
    if (input.action === 'edit') return Response.json(await editPipelineReview(payload, user, input))
    if (input.action === 'approve') {
      const {env}=await getCloudflareContext({async:true})
      return Response.json(await approvePipeline(payload, user, input, env))
    }
    return Response.json({ error: 'Unknown pipeline action' }, { status: 400 })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Pipeline failed' }, { status: 400 }) }
}
