// Trusted local fixture setup only. No HTTP endpoint or production identity action.
import {writeFileSync} from 'node:fs'
import {getPayload} from 'payload'
import config from '../payload.config'
import {authConfig,callbackUri} from '../src/auth/config'
import {identityMapping} from '../src/auth/payload'
import {D1AuthStore} from '../src/auth/store'
import {digest} from '../src/auth/oidc'
if(process.env.POC_CLI!=='1')throw new Error('Local CLI mode required')
const payload=await getPayload({config})
const db=(payload.db as unknown as {binding:D1Database}).binding
const settings=authConfig({})
const mapping=identityMapping(payload,settings)
const a=await mapping.map({issuer:settings.issuer,subject:'poc-test-customer-a',name:'Synthetic customer A',email:'same@example.invalid'})
const b=await mapping.map({issuer:settings.issuer,subject:'poc-test-customer-b',name:'Synthetic customer B',email:'same@example.invalid'})
if(a===b)throw new Error('Distinct subjects were merged')
const store=new D1AuthStore(db),now=Math.floor(Date.now()/1000)
const tokens={a:crypto.randomUUID(),b:crypto.randomUUID(),expired:crypto.randomUUID()}
for(const [key,token] of Object.entries(tokens))await store.putSession({tokenHash:await digest(token),userId:key==='b'?b:a,expiresAt:now+(key==='expired'?-10:1800)})
const stateHash=await digest(crypto.randomUUID()),bindingHash=await digest(crypto.randomUUID())
await store.putTransaction({stateHash,bindingHash,verifier:'fixture',nonce:'fixture',redirectUri:callbackUri(settings.directOrigins[0]),expiresAt:now+60})
const consumption=await Promise.all([store.consumeTransaction(stateHash,bindingHash,now),store.consumeTransaction(stateHash,bindingHash,now)])
if(consumption.filter(Boolean).length!==1)throw new Error('D1 callback consumption not atomic')
const stamp=Date.now()
const video=await payload.create({collection:'videos',overrideAccess:true,data:{legacyId:`oidc-private-${stamp}`,legacyType:'Video',slug:`oidc-private-${stamp}`,title:'Private staff-only fixture',_status:'draft'}})
writeFileSync('.runtime/oidc-fixtures.json',JSON.stringify({a,b,tokens,privateVideoId:video.id,expiresAt:now+1800}),{mode:0o600})
writeFileSync('evidence/oidc-d1.json',JSON.stringify({at:new Date().toISOString(),runtime:'local D1 via Wrangler workerd proxy',distinctSubjectIds:true,atomicConcurrentTransactionConsumption:true,opaqueSessionHashStorage:true,scope:'Trusted fixture provisioning, not an actual provider callback'},null,2)+'\n')
console.log('Synthetic OIDC session fixtures created locally; values kept in ignored runtime file.')
await payload.destroy()
process.exit(0)
