import { handle } from '@astrojs/cloudflare/handler'
import { WorkerEntrypoint } from 'cloudflare:workers'
import { cachedAstroProps, canUseCachedAstro } from './lib/public-cache-gateway'

type Props = { host: string }
type Env = {
  PUBLIC_SSR_CACHE_ENABLED?: string
  [key: string]: unknown
}
type ContextWithExports = ExecutionContext & {
  exports: {
    CachedAstro(options: { props: Props }): { fetch(request: Request): Promise<Response> }
  }
}

function withRoute(response: Response, route: 'public-cache' | 'bypass'): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Website-Cache-Route', route)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

/** Only the public entrypoint enables Workers Cache. It receives requests only
 * after the default gateway has screened cookies, credentials, and routes. */
export class CachedAstro extends WorkerEntrypoint<Env, Props> {
  fetch(request: Request): Promise<Response> {
    return handle(request, this.env, this.ctx)
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (canUseCachedAstro(request, env.PUBLIC_SSR_CACHE_ENABLED === 'true')) {
      const cached = (ctx as ContextWithExports).exports.CachedAstro({ props: cachedAstroProps(request) })
      return withRoute(await cached.fetch(request), 'public-cache')
    }
    return withRoute(await handle(request, env, ctx), 'bypass')
  },
}
