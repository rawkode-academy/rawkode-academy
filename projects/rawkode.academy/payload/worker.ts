import {WorkerEntrypoint} from 'cloudflare:workers'
import {getPayload} from 'payload'
import config from '@payload-config'
import {authConfig} from './src/auth/config'
import {serveBridge,serveDirect} from './src/ingress'
import {publicContentBridge} from './src/public-content-bridge'
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
// Bound only to the Astro site Worker. It exposes the explicitly projected,
// published content read model and never adds a public Payload REST route.
export class PublicContentBridge extends WorkerEntrypoint<CloudflareEnv> {
  async fetch(request: Request) {
    const payload = await getPayload({ config })
    return publicContentBridge(request, payload, this.env.R2)
  }
}
export {MediaWorkflow} from './src/media-workflow'

export { ReviewMediaWorkflow } from './src/review-workflow'

export { ReviewFFmpegContainer } from './src/review-container'

export { D2RenderContainer } from './src/d2-container'
