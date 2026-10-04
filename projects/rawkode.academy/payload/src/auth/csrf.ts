export function hasOidcCookie(headers:Headers) {return /(?:^|;\s*)(?:__Host-)?poc-oidc-session=/.test(headers.get('cookie')??'')}
export function rejectOidcMutation(request:Request,origin:string) {
  return !['GET','HEAD','OPTIONS'].includes(request.method) && hasOidcCookie(request.headers) && request.headers.get('origin')!==origin
}
