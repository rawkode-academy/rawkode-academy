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
  if (!env?.AI || !env.REVIEW_FFMPEG || !env.REVIEW_MEDIA_WORKFLOW || env.REVIEW_MEDIA_RECIPE !== mediaRecipe || !store) return undefined
  return new WorkflowMediaAdapter(mediaRecipe, env.REVIEW_MEDIA_WORKFLOW, new ProcessingJobs(store, env.R2))
}
