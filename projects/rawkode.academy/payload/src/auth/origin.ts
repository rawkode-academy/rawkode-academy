import {LOOPBACK_ORIGIN,callbackUri,type AuthConfig} from './config'
// The header is trusted only because both worker.ts entrypoints (the default
// fetch handler and the ReviewBridge service-binding entrypoint) always strip it
// and set it only after their own allowlist check of the raw request URL, and
// ReviewBridge has no public route. A browser cannot supply it.
export const PUBLIC_ORIGIN_HEADER = 'x-academy-public-origin'
export class UntrustedOrigin extends Error {
  constructor() { super('Untrusted application origin'); this.name='UntrustedOrigin' }
}
export function requestOrigin(headers:Headers,config:AuthConfig):string|null {
  const stamped=headers.get(PUBLIC_ORIGIN_HEADER)
  if(stamped!==null)return config.origins.includes(stamped)?stamped:null
  // `next dev` requests never pass through worker.ts.
  return config.local&&headers.get('host')==='127.0.0.1:3100'?LOOPBACK_ORIGIN:null
}
export function requestSite(request:Request,config:AuthConfig) {
  const origin=requestOrigin(request.headers,config)
  if(!origin)throw new UntrustedOrigin()
  const url=new URL(request.url)
  if(request.headers.has(PUBLIC_ORIGIN_HEADER)) {
    // Ingress already validated the raw request URL. A host rewrite inside
    // OpenNext/Next cannot widen trust, so path checks use the stamped origin.
    const site=new URL(origin)
    url.protocol=site.protocol;url.host=site.host
  } else {
    // Next normalizes its loopback request URL to localhost. Accept only this
    // observed internal spelling when the actual Host is the registered 127.0.0.1.
    if(url.origin==='http://localhost:3100')url.hostname='127.0.0.1'
    if(url.origin!==origin)throw new UntrustedOrigin()
  }
  return {url,origin,redirectUri:callbackUri(origin)}
}
