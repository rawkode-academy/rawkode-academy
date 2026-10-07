import { createThumbnailHandlers } from '../../../../../src/review/thumbnails'
import { reviewRuntime } from '../../../../../src/review/runtime'

export const { GET, HEAD, POST } = createThumbnailHandlers(reviewRuntime)
