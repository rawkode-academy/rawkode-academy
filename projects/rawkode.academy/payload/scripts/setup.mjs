import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
mkdirSync('.runtime',{recursive:true})
if (!existsSync('.dev.vars')) writeFileSync('.dev.vars',`PAYLOAD_SECRET=${randomBytes(32).toString('hex')}\nPIPELINE_CALLBACK_SECRET=${randomBytes(32).toString('hex')}\n`,{mode:0o600})
if (!existsSync('.runtime/admin.json')) writeFileSync('.runtime/admin.json',JSON.stringify({email:'editor@example.invalid',password:randomBytes(24).toString('base64url')})+'\n',{mode:0o600})
console.log('Local-only secrets generated; no credentials imported. Staff credentials: .runtime/admin.json')
