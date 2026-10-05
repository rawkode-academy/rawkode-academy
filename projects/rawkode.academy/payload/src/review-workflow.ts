import { NonRetryableError } from 'cloudflare:workflows'
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import { ReviewError } from './review/contracts'
import { ReviewStore } from './review/store'
import { ProcessingJobs } from './review/processing-jobs'
import { ContainerFFmpegClient, WorkersWhisper } from './review/processing-providers'
import { runReviewProcessing, type DurableSteps } from './review/processing-workflow'
import type { ReviewWorkflowParams } from './review/workflow-adapter'
import { mediaRecipe, type MediaRuntime } from './review/processing-runtime'
type Env = MediaRuntime
export class ReviewMediaWorkflow extends WorkflowEntrypoint<Env, ReviewWorkflowParams> {
  async run(event: WorkflowEvent<ReviewWorkflowParams>, step: WorkflowStep) {
    if (event.instanceId !== event.payload.jobId) throw new NonRetryableError('Workflow ID must equal the registered job')
    if (!this.env.REVIEW_FFMPEG || !this.env.AI || this.env.REVIEW_MEDIA_RECIPE !== mediaRecipe) throw new NonRetryableError('Verified Container recipe and AI providers are required')
    const jobs = new ProcessingJobs(new ReviewStore(this.env.D1), this.env.R2)
    const steps: DurableSteps = { do: (name, callback) => step.do(name, { retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' }, timeout: '3 minutes' }, async () => {
      try { return await callback() }
      catch (error) { if (error instanceof ReviewError && error.status < 500) throw new NonRetryableError(error.message); throw error }
    }) }
    return runReviewProcessing(event.payload.jobId, jobs, new ContainerFFmpegClient(this.env.REVIEW_FFMPEG), new WorkersWhisper(this.env.AI, this.env.R2), steps)
  }
}
