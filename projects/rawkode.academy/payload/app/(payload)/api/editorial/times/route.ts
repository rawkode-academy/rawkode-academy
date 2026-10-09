import { createEditorialHandlers } from '../../../../../src/editorial/http'
import { editorialRuntime } from '../../../../../src/editorial/runtime'
export const { GET, POST } = createEditorialHandlers(editorialRuntime)
