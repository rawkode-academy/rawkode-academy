import { createStudioAdoptionListHandlers } from '../../../../../src/review/studio-http'
import { reviewRuntime, studioPendingList } from '../../../../../src/review/runtime'
export const { GET } = createStudioAdoptionListHandlers(async request => {
  const runtime = await reviewRuntime(request)
  return { actor: runtime.actor, handoff: studioPendingList(runtime) }
})
