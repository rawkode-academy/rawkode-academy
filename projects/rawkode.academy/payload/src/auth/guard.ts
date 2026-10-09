import {cloudflare} from '../cloudflare'
import {authConfig} from './config'
import {rejectOidcMutationFor} from './csrf'
import {requestOrigin} from './origin'
export async function oidcCsrfFailure(request:Request):Promise<Response|null> {
  const config=authConfig(cloudflare.env)
  return rejectOidcMutationFor(request,requestOrigin(request.headers,config))?Response.json({error:'Untrusted request origin'},{status:403,headers:{'cache-control':'no-store'}}):null
}
export function withOidcCsrf<Args extends unknown[]>(handler:(request:Request,...args:Args)=>Promise<Response>) {
  return async(request:Request,...args:Args)=>await oidcCsrfFailure(request)??handler(request,...args)
}
