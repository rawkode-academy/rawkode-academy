import config from '@payload-config'
import { getPayload } from 'payload'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { completePipeline, type PipelineOutput } from '../../../../../../src/pipeline'

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true })
  if (!env.PIPELINE_CALLBACK_SECRET || request.headers.get('authorization') !== `Bearer ${env.PIPELINE_CALLBACK_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const payload = await getPayload({ config })
    return Response.json(await completePipeline(payload, await request.json() as PipelineOutput))
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Callback failed' }, { status: 400 }) }
}
