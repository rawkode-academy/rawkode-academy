import {runtimeAuth} from '../../../../../src/auth/runtime'
export async function GET(request:Request) {
  try {return await (await runtimeAuth()).begin(request)}
  catch(error) {console.error('OIDC discovery unavailable',error instanceof Error?error.message:'unknown');return Response.json({error:'Sign-in is unavailable'},{status:503,headers:{'cache-control':'no-store'}})}
}
