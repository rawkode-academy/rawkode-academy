import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { localVars } from './local-vars.mjs'
mkdirSync('.runtime',{recursive:true})
if (!existsSync('.dev.vars')) writeFileSync('.dev.vars',`PAYLOAD_SECRET=${randomBytes(32).toString('hex')}\nPIPELINE_CALLBACK_SECRET=${randomBytes(32).toString('hex')}\n`,{mode:0o600})
if (!existsSync('.runtime/admin.json')) writeFileSync('.runtime/admin.json',JSON.stringify({email:'editor@example.invalid',password:randomBytes(24).toString('base64url')})+'\n',{mode:0o600})
// next dev and the seed scripts read this file (POC_CLOUDFLARE_ENV_FILE). It carries the
// secrets too, in case it replaces .dev.vars loading. It is never passed to a remote command.
const secrets = readFileSync('.dev.vars','utf8').split('\n').filter(line => /^(PAYLOAD_SECRET|PIPELINE_CALLBACK_SECRET)=/.test(line))
writeFileSync('.runtime/local.vars',[...secrets,...Object.entries(localVars).map(([key,value])=>`${key}=${value}`)].join('\n')+'\n',{mode:0o600})
console.log('Local-only secrets generated; no credentials imported. Staff credentials: .runtime/admin.json')
