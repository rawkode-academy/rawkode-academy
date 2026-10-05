import { createIntakeHandlers } from '../../../../../src/review/intake-http'
import { reviewRuntime } from '../../../../../src/review/runtime'
export const { GET, POST, PUT } = createIntakeHandlers(reviewRuntime)
