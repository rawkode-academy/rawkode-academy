import {getCloudflareContext} from '@opennextjs/cloudflare'
export async function GET(){
  const {env}=await getCloudflareContext({async:true})
  const result=await env.D1.prepare('SELECT 1 AS bindingCheck').first()
  const oidcTables=await env.D1.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('poc_oidc_transactions','poc_oidc_sessions') ORDER BY name").all()
  return Response.json({experimental:true,runtime: navigator.userAgent,d1:result,bindings:{D1:!!env.D1,R2:!!env.R2},oidcTables:oidcTables.results.map(row=>(row as {name:string}).name)})
}
