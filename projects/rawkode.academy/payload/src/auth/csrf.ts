export function hasOidcCookie(headers:Headers) {return /(?:^|;\s*)(?:__Host-)?poc-oidc-session=/.test(headers.get('cookie')??'')}
export function rejectOidcMutation(request:Request,origin:string) {
  return !['GET','HEAD','OPTIONS'].includes(request.method) && hasOidcCookie(request.headers) && request.headers.get('origin')!==origin
}
// A null origin means the request host is not trusted: every cookie-bearing mutation is rejected.
export function rejectOidcMutationFor(request:Request,origin:string|null) {
  return !['GET','HEAD','OPTIONS'].includes(request.method) && hasOidcCookie(request.headers) && (origin===null||request.headers.get('origin')!==origin)
}
