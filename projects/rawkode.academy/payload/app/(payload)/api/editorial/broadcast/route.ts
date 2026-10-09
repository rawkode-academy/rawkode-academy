import { createEditorialMachineHandlers } from '../../../../../src/editorial/http'
import { editorialMachineRuntime, editorialMachineSecret } from '../../../../../src/editorial/runtime'
export const { POST } = createEditorialMachineHandlers({ secret: editorialMachineSecret, runtime: editorialMachineRuntime })
