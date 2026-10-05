import { createStaffReviewerHandlers } from '../../../../../src/review/staff-http'
import { reviewRuntime } from '../../../../../src/review/runtime'
export const { GET } = createStaffReviewerHandlers(reviewRuntime)
