import { DurableObject } from 'cloudflare:workers'
import { z } from 'zod'
import { ReviewError } from './review/contracts'
import { readCommand, reviewFailure } from './review/http'
import { ReviewStore } from './review/store'
import { ProcessingJobs, jobManifest, type ProcessingJob } from './review/processing-jobs'
import { mediaRecipe, type MediaRuntime } from './review/processing-runtime'
import { verifyStored } from './review/intake-storage'
import { ContainerBridge } from './review/container-bridge'
import { boundedBytes } from './review/processing-providers'
import type { Operation } from './review/container-frames'

/** The only caller is the Workflow's DO binding. R2 credentials, object keys and
 * network access are never passed into the FFmpeg image. */
export class ReviewFFmpegContainer extends DurableObject<MediaRuntime> {
  private readonly jobs = new ProcessingJobs(new ReviewStore(this.env.D1), this.env.R2)
  private readonly bridge = new ContainerBridge({ storage: this.ctx.storage, bucket: this.env.R2, live: job => this.live(job), invoke: (operation, job) => this.invoke(operation, job) })
  private async live(job: ProcessingJob) {
    if (this.env.REVIEW_MEDIA_RECIPE !== mediaRecipe || job.recipe !== mediaRecipe) throw new ReviewError(503, 'Verified Container recipe is unavailable')
    const trusted = await this.jobs.load(job.jobId)
    if (JSON.stringify(trusted.job) !== JSON.stringify(job)) throw new ReviewError(409, 'Container job differs from durable admission')
    await verifyStored(this.env.R2, job.source, 'application/octet-stream')
  }
  private async invoke(operation: Operation, job: ProcessingJob) {
    const container = this.ctx.container
    if (!container) throw new ReviewError(503, 'Container runtime binding is unavailable')
    if (!container.running) container.start({ enableInternet: false })
    await container.setInactivityTimeout(180000)
    const port = container.getTcpPort(8080), deadline = Date.now() + 10000
    let ready = false
    while (!ready && Date.now() < deadline) {
      try {
        const response = await port.fetch('http://container/health', { signal: AbortSignal.timeout(1000) })
        const health = z.object({ protocol: z.literal(1), recipe: z.literal(mediaRecipe) }).strict().safeParse(JSON.parse(new TextDecoder().decode(await boundedBytes(response.body, 1024))))
        if (response.ok && health.success) ready = true
        else throw new ReviewError(503, 'Container image recipe does not match this Worker')
      } catch (error) { if (error instanceof ReviewError) throw error; await new Promise(resolve => setTimeout(resolve, 100)) }
    }
    if (!ready) throw new ReviewError(503, 'Container did not become ready')
    await this.live(job)
    const source = await this.env.R2.get(job.source.key, { onlyIf: { etagMatches: job.source.etag } })
    if (!source || !('body' in source)) throw new ReviewError(409, 'Source changed before Container processing')
    return port.fetch(`http://container/${operation}`, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(108000), headers: { 'content-type': 'application/octet-stream', 'content-length': String(job.source.bytes), 'x-review-recipe': mediaRecipe, 'x-review-job': JSON.stringify(job) }, body: source.body })
  }
  async fetch(request: Request) {
    try {
      const match = /^\/jobs\/([0-9a-f-]+)\/(encode|audio)$/.exec(new URL(request.url).pathname)
      if (request.method !== 'POST' || !match) throw new ReviewError(404, 'Unknown Container operation')
      const parsed = z.object({ protocol: z.literal(1), job: jobManifest }).strict().safeParse(await readCommand(request))
      if (!parsed.success || parsed.data.job.jobId !== match[1]) throw new ReviewError(400, 'Invalid Container job')
      return Response.json(await this.bridge.run(match[2] as Operation, parsed.data.job), { headers: { 'cache-control': 'no-store' } })
    } catch (error) { return reviewFailure(error) }
  }
}
