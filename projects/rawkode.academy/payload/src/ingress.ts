import type {AuthConfig} from './auth/config'
import {rejectOidcMutationFor} from './auth/csrf'
import {PUBLIC_ORIGIN_HEADER,requestOrigin} from './auth/origin'
// Must match `reviewRoutes` in website/review/bridge.ts (checked by tests/ingress.test.ts).
export const REVIEW_BRIDGE_ROUTES: Readonly<Record<string, readonly string[]>> = {
  '/api/auth/login': ['GET'], '/api/auth/callback': ['GET'],
  '/api/auth/session': ['GET'], '/api/auth/logout': ['POST'],
  '/api/review': ['GET', 'POST'],
  '/api/review/uploads': ['GET', 'POST', 'PUT'],
  '/api/review/upload-targets': ['GET', 'POST'],
  '/api/review/reviewers': ['GET'],
  '/api/review/thumbnail': ['GET', 'HEAD', 'POST'],
  '/api/review/media': ['GET', 'HEAD'],
  '/api/review/published-media': ['GET', 'HEAD'],
}
export type Downstream = (request:Request)=>Promise<Response>
const noStore = {'cache-control':'no-store'}
const untrusted = () => Response.json({error:'Untrusted request origin'},{status:403,headers:noStore})
// Always drop any client-supplied public origin; stamp only an allowlisted request URL origin.
// Returns headers, not a Request: callers must reject on the original request. Re-wrapping
// moves the body, so wrangler dev's drain middleware skips it and an early 403 leaves the
// body unread, which intermittently breaks the next request on the dev proxy connection.
export function stamp(request:Request,allowed:readonly string[]):{headers:Headers;origin:string|null} {
  const headers=new Headers(request.headers)
  headers.delete(PUBLIC_ORIGIN_HEADER)
  const origin=new URL(request.url).origin
  const trusted=allowed.includes(origin)?origin:null
  if(trusted)headers.set(PUBLIC_ORIGIN_HEADER,trusted)
  return {headers,origin:trusted}
}
// Default entrypoint: the admin custom domain, workers.dev previews, wrangler dev and
// WORKER_SELF_REFERENCE self-calls. Soft gate: an unlisted host runs unstamped, so every
// OIDC surface fails closed while public reads and bearer callbacks keep working.
export async function serveDirect(request:Request,config:AuthConfig,next:Downstream):Promise<Response> {
  const {headers}=stamp(request,config.directOrigins)
  if(rejectOidcMutationFor(request,requestOrigin(headers,config)))return untrusted()
  const stamped=new Request(request,{headers})
  const url=new URL(stamped.url)
  // Preserve the current gateway root URL for GraphQL clients; plain GET shows the POC page.
  if(url.pathname==='/'&&(stamped.method==='POST'||url.searchParams.has('query'))) {
    url.pathname='/graphql'
    return next(new Request(url,stamped))
  }
  return next(stamped)
}
// ReviewBridge entrypoint: reachable only through a service binding. Hard gate on the
// bridge origin and the review route table, so preview never reaches admin, REST or GraphQL.
export async function serveBridge(request:Request,config:AuthConfig,next:Downstream):Promise<Response> {
  const url=new URL(request.url)
  if(!config.bridgeOrigins.includes(url.origin))return Response.json({error:'Misdirected request'},{status:421,headers:noStore})
  const methods=REVIEW_BRIDGE_ROUTES[url.pathname]
  if(!methods)return Response.json({error:'Not found'},{status:404,headers:noStore})
  if(!methods.includes(request.method))return Response.json({error:'Method not allowed'},{status:405,headers:noStore})
  const {headers,origin}=stamp(request,config.bridgeOrigins)
  if(rejectOidcMutationFor(request,origin))return untrusted()
  return next(new Request(request,{headers}))
}
