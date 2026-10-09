import * as oauth from 'oauth4webapi'
import type {AuthConfig} from './config'
import type {AuthStore} from './store'
import {requestSite,UntrustedOrigin} from './origin'
export type Identity = {issuer:string;subject:string;name?:string;email?:string}
export type AuthUser = {id:number;collection:'users';role:'staff'|'customer';name?:string;oidcIssuer?:string;oidcSubject?:string}
export type IdentityMapping = {map(identity:Identity):Promise<number>;user(id:number):Promise<AuthUser|null>}
export async function digest(value:string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('') }
export function readCookie(headers:Headers,name:string):string|null {
  const matches=(headers.get('cookie')??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(name+'='))
  if(matches.length!==1)return null
  const value=matches[0].slice(name.length+1)
  return /^[A-Za-z0-9_-]{32,128}$/.test(value)?value:null
}
export class OidcService {
  constructor(readonly config:AuthConfig,readonly store:AuthStore,readonly mapping:IdentityMapping,private readonly fetcher:typeof fetch=fetch,private readonly now:()=>number=()=>Math.floor(Date.now()/1000)) {}
  private cookie(name:string,value:string,maxAge:number) { return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.config.local?'':'; Secure'}` }
  private headers() { return new Headers({'cache-control':'no-store','pragma':'no-cache','referrer-policy':'no-referrer'}) }
  private async discovery() {
    const issuer=new URL(this.config.issuer)
    const options={[oauth.customFetch]:this.fetcher,signal:AbortSignal.timeout(10000)}
    const server=await oauth.processDiscoveryResponse(issuer,await oauth.discoveryRequest(issuer,options))
    for(const field of ['authorization_endpoint','token_endpoint','userinfo_endpoint','jwks_uri'] as const) {
      const value=server[field]
      if(typeof value!=='string'||new URL(value).origin!==issuer.origin)throw new Error('Untrusted provider endpoint')
    }
    if(!server.code_challenge_methods_supported?.includes('S256'))throw new Error('PKCE S256 required')
    return server
  }
  async begin(request:Request):Promise<Response> {
    const site=requestSite(request,this.config)
    const server=await this.discovery()
    const state=oauth.generateRandomState(),binding=oauth.generateRandomState(),verifier=oauth.generateRandomCodeVerifier(),nonce=oauth.generateRandomNonce()
    await this.store.cleanup(this.now())
    await this.store.putTransaction({stateHash:await digest(state),bindingHash:await digest(binding),verifier,nonce,redirectUri:site.redirectUri,expiresAt:this.now()+this.config.transactionTTL})
    const url=new URL(server.authorization_endpoint!)
    for(const [name,value] of Object.entries({client_id:this.config.clientId,redirect_uri:site.redirectUri,response_type:'code',response_mode:'query',scope:'openid profile email',state,nonce,code_challenge:await oauth.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'}))url.searchParams.set(name,value)
    const headers=this.headers();headers.set('location',url.href);headers.append('set-cookie',this.cookie(this.config.transactionCookie,binding,this.config.transactionTTL))
    return new Response(null,{status:302,headers})
  }
  async callback(request:Request):Promise<Response> {
    const headers=this.headers();headers.append('set-cookie',this.cookie(this.config.transactionCookie,'',0))
    try {
      const site=requestSite(request,this.config),url=site.url
      if(url.origin+url.pathname!==site.redirectUri)throw new Error('Wrong callback')
      for(const key of ['state','code','error','iss'])if(url.searchParams.getAll(key).length>1)throw new Error('Duplicate callback parameter')
      const state=url.searchParams.get('state'),binding=readCookie(request.headers,this.config.transactionCookie)
      if(!state||!binding||!/^[A-Za-z0-9_-]{32,128}$/.test(state))throw new Error('Missing transaction')
      const tx=await this.store.consumeTransaction(await digest(state),await digest(binding),this.now())
      // A login begun on one host can never be completed on another.
      if(!tx||tx.redirectUri!==site.redirectUri)throw new Error('Expired or replayed transaction')
      const server=await this.discovery()
      const client:oauth.Client={client_id:this.config.clientId,id_token_signed_response_alg:'RS256',[oauth.clockTolerance]:0}
      const params=oauth.validateAuthResponse(server,client,url.searchParams,state)
      const options={[oauth.customFetch]:this.fetcher,signal:AbortSignal.timeout(10000)}
      const response=await oauth.authorizationCodeGrantRequest(server,client,oauth.None(),params,tx.redirectUri,tx.verifier,options)
      const tokens=await oauth.processAuthorizationCodeResponse(server,client,response,{expectedNonce:tx.nonce,requireIdToken:true})
      await oauth.validateApplicationLevelSignature(server,response,{[oauth.customFetch]:this.fetcher,signal:AbortSignal.timeout(10000)})
      const claims=oauth.getValidatedIdTokenClaims(tokens)!
      if(!claims.sub||claims.iat>this.now()+30||(claims.azp!==undefined&&claims.azp!==client.client_id))throw new Error('Invalid identity claims')
      const info=await oauth.processUserInfoResponse(server,client,claims.sub,await oauth.userInfoRequest(server,client,tokens.access_token,{[oauth.customFetch]:this.fetcher,signal:AbortSignal.timeout(10000)}))
      const expiresAt=Math.min(this.now()+this.config.sessionTTL,claims.exp,this.now()+(tokens.expires_in??this.config.sessionTTL))
      if(expiresAt<=this.now())throw new Error('Expired identity')
      const userId=await this.mapping.map({issuer:claims.iss,subject:claims.sub,name:typeof info.name==='string'?info.name:undefined,email:info.email_verified===true&&typeof info.email==='string'?info.email:undefined})
      // Rotate the local session; no access/refresh/ID tokens are persisted or sent to the browser.
      const old=readCookie(request.headers,this.config.sessionCookie)
      if(old)await this.store.deleteSession(await digest(old))
      const token=oauth.generateRandomState()
      await this.store.putSession({tokenHash:await digest(token),userId,expiresAt})
      headers.append('set-cookie',this.cookie(this.config.sessionCookie,token,expiresAt-this.now()))
      headers.set('location','/account')
      return new Response(null,{status:303,headers})
    } catch {
      // Never echo provider responses, authorization codes, tokens or personal claims.
      return Response.json({error:'Sign-in could not be verified. Start again.'},{status:400,headers})
    }
  }
  async session(headers:Headers):Promise<{user:AuthUser;expiresAt:number}|null> {
    const token=readCookie(headers,this.config.sessionCookie)
    if(!token)return null
    const session=await this.store.getSession(await digest(token),this.now())
    if(!session)return null
    const user=await this.mapping.user(session.userId)
    if(!user||user.oidcIssuer!==this.config.issuer||!user.oidcSubject)return null
    user.role=this.config.staffSubjects.includes(user.oidcSubject)?'staff':'customer'
    return {user,expiresAt:session.expiresAt}
  }
  async logout(request:Request):Promise<Response> {
    let origin:string
    try {origin=requestSite(request,this.config).origin}
    catch(error) {if(error instanceof UntrustedOrigin)return Response.json({error:'Forbidden'},{status:403,headers:this.headers()});throw error}
    if(request.headers.get('origin')!==origin)return Response.json({error:'Forbidden'},{status:403,headers:this.headers()})
    const token=readCookie(request.headers,this.config.sessionCookie)
    if(token)await this.store.deleteSession(await digest(token))
    const headers=this.headers();headers.append('set-cookie',this.cookie(this.config.sessionCookie,'',0))
    return Response.json({signedOut:true},{headers})
  }
}
