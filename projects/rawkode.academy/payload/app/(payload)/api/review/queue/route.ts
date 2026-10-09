import { createQueueHandlers } from '../../../../../src/review/queue-http'
import { reviewRuntime } from '../../../../../src/review/runtime'
export const { GET } = createQueueHandlers(reviewRuntime)
