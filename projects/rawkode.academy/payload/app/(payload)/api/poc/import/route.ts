import {oidcCsrfFailure} from '../../../../../src/auth/guard'
import {isStaff} from '../../../../../src/auth/access'
import config from '@payload-config'
import {getPayload} from 'payload'
import {importCatalogue} from '../../../../../src/importer'
export async function POST(request:Request){
  const csrfFailure=await oidcCsrfFailure(request);if(csrfFailure)return csrfFailure
  const payload=await getPayload({config})
  const {user}=await payload.auth({headers:request.headers})
  if(!isStaff(user))return Response.json({error:'Unauthorized'},{status:401})
  const {snapshot,dryRun=true}=await request.json() as {snapshot: import('../../../../../src/importer').CatalogueSnapshot,dryRun?:boolean}
  try{return Response.json(await importCatalogue(payload,user,snapshot,{dryRun}))}
  catch(error){return Response.json({error:error instanceof Error?error.message:'Import failed'},{status:400})}
}
