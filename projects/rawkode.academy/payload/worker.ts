import {rejectOidcMutation} from './src/auth/csrf'
import {authConfig} from './src/auth/config'
// OpenNext creates this module during build:worker.
// @ts-ignore Generated Workers entry point has no TypeScript declaration.
import openNextHandler from './.open-next/worker.js'
const handler: ExportedHandler = openNextHandler
export default {
  ...handler,
  fetch(request, env, context) {
    const url = new URL(request.url)
    const auth = authConfig(env)
    if (rejectOidcMutation(request,auth.origin)) {
      return Response.json({error:'Untrusted request origin'},{status:403,headers:{'cache-control':'no-store'}})
    }
    // Preserve the current gateway root URL for GraphQL clients; plain GET shows the POC page.
    if (url.pathname === '/' && (request.method === 'POST' || url.searchParams.has('query'))) {
      url.pathname = '/graphql'
      request = new Request(url, request) as typeof request
    }
    return handler.fetch!(request, env, context)
  },
} satisfies ExportedHandler<CloudflareEnv>
export {MediaWorkflow} from './src/media-workflow'

export { ReviewMediaWorkflow } from './src/review-workflow'
