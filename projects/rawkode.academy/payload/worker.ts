import {WorkerEntrypoint} from 'cloudflare:workers'
import {authConfig} from './src/auth/config'
import {serveBridge,serveDirect} from './src/ingress'
// OpenNext creates this module during build:worker.
// @ts-ignore Generated Workers entry point has no TypeScript declaration.
import openNextHandler from './.open-next/worker.js'
const handler: ExportedHandler = openNextHandler
type IncomingRequest = Parameters<NonNullable<ExportedHandler['fetch']>>[0]
export default {
  ...handler,
  fetch(request, env, context) {
    return serveDirect(request,authConfig(env),async req=>handler.fetch!(req as IncomingRequest,env,context))
  },
} satisfies ExportedHandler<CloudflareEnv>
// Bound only by the website review Worker (preview.rawkode.academy) as
// rawkode-academy-payload#ReviewBridge. It has no public route.
export class ReviewBridge extends WorkerEntrypoint<CloudflareEnv> {
  fetch(request: Request) {
    return serveBridge(request,authConfig(this.env),async req=>handler.fetch!(req as IncomingRequest,this.env,this.ctx))
  }
}
export {MediaWorkflow} from './src/media-workflow'

export { ReviewMediaWorkflow } from './src/review-workflow'

export { ReviewFFmpegContainer } from './src/review-container'
