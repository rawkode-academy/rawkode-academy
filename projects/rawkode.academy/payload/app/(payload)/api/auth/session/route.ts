import {runtimeAuth} from '../../../../../src/auth/runtime'
export async function GET(request:Request) {
  const session=await (await runtimeAuth()).session(request.headers)
  const headers={'cache-control':'no-store','vary':'Cookie'}
  if(!session)return Response.json({error:'Unauthorized'},{status:401,headers})
  return Response.json({user:{id:session.user.id,name:session.user.name,role:session.user.role},expiresAt:session.expiresAt},{headers})
}
