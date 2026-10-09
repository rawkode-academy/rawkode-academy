export type AuthEnvironment = {
  OIDC_ISSUER?: string
  OIDC_CLIENT_ID?: string
  OIDC_DIRECT_ORIGINS?: string
  OIDC_BRIDGE_ORIGINS?: string
  REVIEW_PUBLIC_MEDIA_ORIGIN?: string
  OIDC_STAFF_SUBJECTS?: string
  OIDC_SESSION_TTL_SECONDS?: string
  POC_DEV_LOCAL_AUTH?: string
}
export type AuthConfig = ReturnType<typeof authConfig>
export const LOOPBACK_ORIGIN = 'http://127.0.0.1:3100'
export const CALLBACK_PATH = '/api/auth/callback'
export const WORKER_PREVIEW_ORIGIN = 'https://pr-local-rawkode-academy-payload.rawkodeacademy.workers.dev'
export const WORKER_PREVIEW_CALLBACK_URI = WORKER_PREVIEW_ORIGIN + CALLBACK_PATH
// Mirrors the callbacks registered for rawkode-academy-preview in identity (src/lib/auth.ts).
export const REGISTERED_ORIGINS: readonly string[] = [LOOPBACK_ORIGIN,'https://preview.rawkode.academy','https://admin.rawkode.academy',WORKER_PREVIEW_ORIGIN]
export const callbackUri = (origin:string) => origin + CALLBACK_PATH
function jsonStrings(name:string,raw:string|undefined,fallback:string[]):string[] {
  if(raw===undefined)return fallback
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || value.some(s => typeof s !== 'string' || !s)) throw new Error(`${name} must be an explicit JSON array of strings`)
  return value as string[]
}
export function authConfig(env: AuthEnvironment) {
  const issuer = env.OIDC_ISSUER ?? 'https://id.rawkode.academy'
  const clientId = env.OIDC_CLIENT_ID ?? 'rawkode-academy-preview'
  if (issuer !== 'https://id.rawkode.academy' || clientId !== 'rawkode-academy-preview') throw new Error('Unexpected Academy identity configuration')
  const directOrigins = jsonStrings('OIDC_DIRECT_ORIGINS',env.OIDC_DIRECT_ORIGINS,[LOOPBACK_ORIGIN])
  const bridgeOrigins = jsonStrings('OIDC_BRIDGE_ORIGINS',env.OIDC_BRIDGE_ORIGINS,[])
  if (!directOrigins.length) throw new Error('OIDC_DIRECT_ORIGINS must name at least one origin')
  const origins = [...directOrigins,...bridgeOrigins]
  if (origins.some(origin => !REGISTERED_ORIGINS.includes(origin))) throw new Error('Unregistered application origin')
  if (new Set(origins).size !== origins.length) throw new Error('Application origins must be unique across direct and bridge lists')
  const local = origins.every(origin => origin === LOOPBACK_ORIGIN)
  if (!local && origins.includes(LOOPBACK_ORIGIN)) throw new Error('Loopback cannot be combined with hosted origins')
  if (bridgeOrigins.some(origin => new URL(origin).protocol !== 'https:')) throw new Error('Bridge origins must use https')
  const localAuth = env.POC_DEV_LOCAL_AUTH === 'true'
  if (localAuth && !local) throw new Error('Local staff fallback is forbidden on the production origin')
  const publicMediaOrigin = env.REVIEW_PUBLIC_MEDIA_ORIGIN ?? directOrigins[0]
  if (!directOrigins.includes(publicMediaOrigin)) throw new Error('REVIEW_PUBLIC_MEDIA_ORIGIN must be a direct origin')
  const sessionTTL = Number(env.OIDC_SESSION_TTL_SECONDS ?? 3600)
  if (!Number.isInteger(sessionTTL) || sessionTTL < 60 || sessionTTL > 3600) throw new Error('Session lifetime must be 60–3600 seconds')
  const staffSubjects = jsonStrings('OIDC_STAFF_SUBJECTS',env.OIDC_STAFF_SUBJECTS,[])
  return {issuer,clientId,directOrigins,bridgeOrigins,origins,publicMediaOrigin,local,localAuth,sessionTTL,staffSubjects,transactionTTL:600,
    sessionCookie:local?'poc-oidc-session':'__Host-poc-oidc-session',
    transactionCookie:local?'poc-oidc-transaction':'__Host-poc-oidc-transaction'}
}
