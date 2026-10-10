import path from 'node:path'
import { experimentalD1Adapter } from './src/d1-adapter'
import { r2Storage } from '@payloadcms/storage-r2'
import {cloudflare} from './src/cloudflare'
import { buildConfig } from 'payload'
import { optionalPlugins, optionalGlobals } from './src/optional-mcp'
import { createCollections } from './src/collections'
import {authConfig} from './src/auth/config'
import {adminConfig} from './src/admin/config'
import {parseDeveloperSubjects,type AdminAccess} from './src/admin/access'
import {assertCuid2DocumentSchema} from './src/id-schema'

const secret = cloudflare.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET
if (!secret) throw new Error('Run bun run setup to generate isolated local secrets first')
const migrationChain = process.env.POC_MIGRATION_CHAIN
if (process.env.POC_CLI === '1' && migrationChain !== 'legacy' && migrationChain !== 'cuid2') {
  throw new Error('Refusing Payload CLI startup without an explicit target-selected migration chain.')
}
const useCuid2Chain = migrationChain !== 'legacy'
const auth = authConfig(cloudflare.env)
// Admin visibility only (nav, Source tab, System tables). Same strict JSON-array
// format as OIDC_STAFF_SUBJECTS; malformed values fail closed at startup.
const adminAccess: AdminAccess = {
  developerSubjects: parseDeveloperSubjects((cloudflare.env as {DEVELOPER_SUBJECTS?: string}).DEVELOPER_SUBJECTS, auth.staffSubjects),
  localAuth: auth.localAuth,
}
const log = (level:string) => (value:unknown, message?:string) => console.log(JSON.stringify({level, message, value},(_key,item)=>item instanceof Error?{name:item.name,message:item.message}:item))
export default buildConfig({
  admin: { user:'users', importMap:{baseDir:path.resolve(process.cwd())}, ...adminConfig },
  csrf:auth.origins,
  // Server-only. adminAccess is read by admin server components; never put it in admin.custom.
  custom:{adminAccess},
  collections:createCollections(auth,cloudflare.env.D1,adminAccess,{d2Renderer:(cloudflare.env as CloudflareEnv & {D2_RENDERER?:DurableObjectNamespace}).D2_RENDERER}),
  // The website reads through PublicContentBridge. Admin and staff clients use
  // Payload REST, so there is no need to expose a second generated content API.
  graphQL:{disable:true},
  globals:optionalGlobals,
  secret,
  typescript:{autoGenerate:false,outputFile:path.resolve('payload-types.ts')},
  // D1 stores document IDs as TEXT. Hooks and the importer supply canonical
  // CUID2 values; videos use their existing CUID2 R2 content IDs as primary IDs.
  db:experimentalD1Adapter({binding:cloudflare.env.D1,push:false,migrationDir:path.resolve(useCuid2Chain ? 'src/migrations-cuid2' : 'src/migrations'),idType:useCuid2Chain?'uuid':'number',allowIDOnCreate:true}),
  logger: {level:'warn',trace:log('trace'),debug:log('debug'),info:log('info'),warn:log('warn'),error:log('error'),fatal:log('fatal'),silent:()=>{}} as never,
  plugins:[...optionalPlugins,r2Storage({bucket:cloudflare.env.R2,collections:{media:true}})],
  onInit: async () => assertCuid2DocumentSchema(cloudflare.env.D1),
})
