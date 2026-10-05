import { ReviewError } from './contracts'
import type { ContainerMediaAdapter, MediaProcessInput } from './intake-contracts'
import { ProcessingJobs } from './processing-jobs'
export type ReviewWorkflowParams = { jobId: string }
export class WorkflowMediaAdapter implements ContainerMediaAdapter {
  constructor(readonly recipe: string, readonly workflow: Pick<Workflow<ReviewWorkflowParams>, 'create' | 'get'>, readonly jobs: ProcessingJobs) {}
  async process(input: MediaProcessInput) {
    const saved = await this.jobs.load(input.jobId), job = saved.job
    if (job.recipe !== this.recipe || JSON.stringify(input.source) !== JSON.stringify(job.source) || input.outputKey !== job.outputKey || input.maximumBytes !== job.maximumBytes || input.maximumDurationMs !== job.maximumDurationMs) throw new ReviewError(409, 'Workflow dispatch does not match the registered job')
    if (saved.result) return saved.result // Survives Workflow retention/lost replies.
    let instance: WorkflowInstance
    try { instance = await this.workflow.create({ id: job.jobId, params: { jobId: job.jobId } }) }
    catch (error) {
      // Creation may have succeeded before acknowledgement was lost. Reading
      // the exact ID recovers it; unrelated errors never select a new job ID.
      try { instance = await this.workflow.get(job.jobId) }
      catch { throw error }
    }
    const status = await instance.status()
    if (['errored', 'terminated'].includes(status.status)) throw new ReviewError(409, 'Durable processing failed; create a new intake')
    if (status.status === 'complete') {
      const complete = await this.jobs.load(job.jobId)
      if (!complete.result) throw new ReviewError(409, 'Workflow completed without verified persisted evidence')
      return complete.result
    }
    // Never trust status.output as media evidence, even from this binding.
    return { state: 'processing' as const }
  }
}
