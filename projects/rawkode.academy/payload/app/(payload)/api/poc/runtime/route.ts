import {getCloudflareContext} from '@opennextjs/cloudflare'
export async function GET(){
  const {env}=await getCloudflareContext({async:true})
  const result=await env.D1.prepare('SELECT 1 AS bindingCheck').first()
  return Response.json({experimental:true,runtime: navigator.userAgent,d1:result,bindings:{D1:!!env.D1,R2:!!env.R2}})
}
