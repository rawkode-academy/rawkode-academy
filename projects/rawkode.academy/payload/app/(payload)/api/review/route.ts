import { createReviewHandlers } from '../../../../src/review/http'
import { reviewRuntime } from '../../../../src/review/runtime'
export const { GET, POST } = createReviewHandlers(reviewRuntime)
