import config from '@payload-config'
import {rejectOidcMutation} from './csrf'
export async function oidcCsrfFailure(request:Request):Promise<Response|null> {
  const {custom}=await config
  return rejectOidcMutation(request,custom.oidcOrigin)?Response.json({error:'Untrusted request origin'},{status:403,headers:{'cache-control':'no-store'}}):null
}
export function withOidcCsrf<Args extends unknown[]>(handler:(request:Request,...args:Args)=>Promise<Response>) {
  return async(request:Request,...args:Args)=>await oidcCsrfFailure(request)??handler(request,...args)
}
