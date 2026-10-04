import path from 'node:path'
import { experimentalD1Adapter } from './src/d1-adapter'
import { r2Storage } from '@payloadcms/storage-r2'
import {cloudflare} from './src/cloudflare'
import { buildConfig } from 'payload'
import { optionalPlugins, optionalGlobals } from './src/optional-mcp'
import { createCollections } from './src/collections'
import {authConfig} from './src/auth/config'

const secret = cloudflare.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET
if (!secret) throw new Error('Run bun run setup to generate isolated local secrets first')
const log = (level:string) => (value:unknown, message?:string) => console.log(JSON.stringify({level, message, value},(_key,item)=>item instanceof Error?{name:item.name,message:item.message}:item))
export default buildConfig({
  admin: { user:'users', importMap:{baseDir:path.resolve(process.cwd())},components:{beforeLogin:['./src/components/AcademyLogin#AcademyLogin']} },
  csrf:[authConfig(cloudflare.env).origin],
  custom:{oidcOrigin:authConfig(cloudflare.env).origin},
  collections:createCollections(authConfig(cloudflare.env),cloudflare.env.D1),
  graphQL:{disableIntrospectionInProduction:false},
  globals:optionalGlobals,
  secret,
  typescript:{autoGenerate:false,outputFile:path.resolve('payload-types.ts')},
  db:experimentalD1Adapter({binding:cloudflare.env.D1,push:false,migrationDir:path.resolve('src/migrations')}),
  logger: {level:'warn',trace:log('trace'),debug:log('debug'),info:log('info'),warn:log('warn'),error:log('error'),fatal:log('fatal'),silent:()=>{}} as never,
  plugins:[...optionalPlugins,r2Storage({bucket:cloudflare.env.R2,collections:{media:true}})],
})
