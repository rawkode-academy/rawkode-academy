import {oidcCsrfFailure} from '../../../../../src/auth/guard'
import {isStaff} from '../../../../../src/auth/access'
import config from '@payload-config'
import {getPayload} from 'payload'
import {importCatalogue} from '../../../../../src/importer'
import type {ImportSnapshot} from '../../../../../src/import-types'
import {isLoopbackRequest} from '../../../../../src/local-request'
export async function POST(request:Request){
  // Remote imports go through the CLI target guard (scripts/import-static.ts).
  if(!isLoopbackRequest(request))return Response.json({error:'Not found'},{status:404})
  const csrfFailure=await oidcCsrfFailure(request);if(csrfFailure)return csrfFailure
  const payload=await getPayload({config})
  const {user}=await payload.auth({headers:request.headers})
  if(!isStaff(user))return Response.json({error:'Unauthorized'},{status:401})
  const {snapshot,dryRun=true}=await request.json() as {snapshot: ImportSnapshot,dryRun?:boolean}
  try{return Response.json(await importCatalogue(payload,user,snapshot,{dryRun}))}
  catch(error){return Response.json({error:error instanceof Error?error.message:'Import failed'},{status:400})}
}
