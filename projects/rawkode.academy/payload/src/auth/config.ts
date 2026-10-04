export type AuthEnvironment = {
  OIDC_ISSUER?: string
  OIDC_CLIENT_ID?: string
  OIDC_REDIRECT_URI?: string
  OIDC_STAFF_SUBJECTS?: string
  OIDC_SESSION_TTL_SECONDS?: string
  POC_DEV_LOCAL_AUTH?: string
}
export type AuthConfig = ReturnType<typeof authConfig>
export function authConfig(env: AuthEnvironment) {
  const issuer = env.OIDC_ISSUER ?? 'https://id.rawkode.academy'
  const clientId = env.OIDC_CLIENT_ID ?? 'rawkode-academy-preview'
  const redirectUri = env.OIDC_REDIRECT_URI ?? 'http://127.0.0.1:3100/api/auth/callback'
  if (issuer !== 'https://id.rawkode.academy' || clientId !== 'rawkode-academy-preview') throw new Error('Unexpected Academy identity configuration')
  if (!['http://127.0.0.1:3100/api/auth/callback','https://preview.rawkode.academy/api/auth/callback','https://admin.rawkode.academy/api/auth/callback'].includes(redirectUri)) throw new Error('Unregistered callback URI')
  const origin = new URL(redirectUri).origin
  const local = origin === 'http://127.0.0.1:3100'
  const localAuth = env.POC_DEV_LOCAL_AUTH === 'true'
  if (localAuth && !local) throw new Error('Local staff fallback is forbidden on the production origin')
  const sessionTTL = Number(env.OIDC_SESSION_TTL_SECONDS ?? 3600)
  if (!Number.isInteger(sessionTTL) || sessionTTL < 60 || sessionTTL > 3600) throw new Error('Session lifetime must be 60–3600 seconds')
  const subjects: unknown = JSON.parse(env.OIDC_STAFF_SUBJECTS ?? '[]')
  if (!Array.isArray(subjects) || subjects.some(s => typeof s !== 'string' || !s)) throw new Error('OIDC_STAFF_SUBJECTS must be an explicit JSON array of subjects')
  return {issuer,clientId,redirectUri,origin,local,localAuth,sessionTTL,staffSubjects:subjects as string[],transactionTTL:600,
    sessionCookie:local?'poc-oidc-session':'__Host-poc-oidc-session',
    transactionCookie:local?'poc-oidc-transaction':'__Host-poc-oidc-transaction'}
}
