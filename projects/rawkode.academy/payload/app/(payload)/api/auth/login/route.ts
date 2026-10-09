import {runtimeAuth} from '../../../../../src/auth/runtime'
import {UntrustedOrigin} from '../../../../../src/auth/origin'
export async function GET(request:Request) {
  try {return await (await runtimeAuth()).begin(request)}
  catch(error) {
    if(error instanceof UntrustedOrigin)return Response.json({error:'Sign-in is not available on this host'},{status:421,headers:{'cache-control':'no-store'}})
    console.error('OIDC discovery unavailable',error instanceof Error?error.message:'unknown');return Response.json({error:'Sign-in is unavailable'},{status:503,headers:{'cache-control':'no-store'}})
  }
}
