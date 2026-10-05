import lock from '../../container/recipe.json'
import { ProcessingJobs } from './processing-jobs'
import { WorkflowMediaAdapter, type ReviewWorkflowParams } from './workflow-adapter'
import type { ReviewStore } from './store'
export const mediaRecipe = lock.recipe
export type MediaRuntime = {
  D1: D1Database; R2: R2Bucket; AI?: Ai;
  REVIEW_FFMPEG?: DurableObjectNamespace;
  REVIEW_MEDIA_WORKFLOW?: Workflow<ReviewWorkflowParams>;
  REVIEW_MEDIA_RECIPE?: string;
}
export function configuredMediaAdapter(env?: MediaRuntime, store?: ReviewStore) {
  // The request Worker only dispatches the durable Workflow. The Workflow's
  // hosting Worker owns Workers AI, the Container binding, and its D1/R2
  // resources. This distinction is required for Cloudflare Worker Previews:
  // Preview Workflow bindings attach to an existing Workflow rather than
  // provisioning a Workflow in the Preview itself.
  if (!env?.REVIEW_MEDIA_WORKFLOW || env.REVIEW_MEDIA_RECIPE !== mediaRecipe || !store) return undefined
  return new WorkflowMediaAdapter(mediaRecipe, env.REVIEW_MEDIA_WORKFLOW, new ProcessingJobs(store, env.R2))
}
