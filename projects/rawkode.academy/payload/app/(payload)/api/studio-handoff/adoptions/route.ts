import { createStudioHandoffHandlers } from '../../../../../src/review/studio-http'
import { studioBindings, studioHandoffRuntime } from '../../../../../src/review/runtime'
export const { GET, POST } = createStudioHandoffHandlers({ bindings: studioBindings, runtime: studioHandoffRuntime })
