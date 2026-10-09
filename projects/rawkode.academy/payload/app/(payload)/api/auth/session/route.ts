import {runtimeAuth,runtimeAuthConfig} from '../../../../../src/auth/runtime'
import {requestOrigin} from '../../../../../src/auth/origin'
export async function GET(request:Request) {
  const headers={'cache-control':'no-store','vary':'Cookie'}
  if(!requestOrigin(request.headers,runtimeAuthConfig()))return Response.json({error:'Unauthorized'},{status:401,headers})
  const session=await (await runtimeAuth()).session(request.headers)
  if(!session)return Response.json({error:'Unauthorized'},{status:401,headers})
  return Response.json({user:{id:session.user.id,name:session.user.name,role:session.user.role},expiresAt:session.expiresAt},{headers})
}
