export type Transaction = {stateHash:string;bindingHash:string;verifier:string;nonce:string;redirectUri:string;expiresAt:number}
export type Session = {tokenHash:string;userId:number;expiresAt:number}
export interface AuthStore {
  putTransaction(value:Transaction):Promise<void>
  consumeTransaction(stateHash:string,bindingHash:string,now:number):Promise<Transaction|null>
  putSession(value:Session):Promise<void>
  getSession(tokenHash:string,now:number):Promise<Session|null>
  deleteSession(tokenHash:string):Promise<void>
  cleanup(now:number):Promise<void>
}
export class D1AuthStore implements AuthStore {
  constructor(private readonly db:D1Database) {}
  async putTransaction(t:Transaction) { await this.db.prepare('INSERT INTO poc_oidc_transactions(state_hash,binding_hash,verifier,nonce,redirect_uri,expires_at) VALUES(?,?,?,?,?,?)').bind(t.stateHash,t.bindingHash,t.verifier,t.nonce,t.redirectUri,t.expiresAt).run() }
  async consumeTransaction(stateHash:string,bindingHash:string,now:number) {
    // Single SQL statement: only one callback can consume the browser-bound transaction.
    return this.db.prepare('DELETE FROM poc_oidc_transactions WHERE state_hash=? AND binding_hash=? AND expires_at>? RETURNING state_hash AS stateHash,binding_hash AS bindingHash,verifier,nonce,redirect_uri AS redirectUri,expires_at AS expiresAt').bind(stateHash,bindingHash,now).first<Transaction>()
  }
  async putSession(s:Session) { await this.db.prepare('INSERT INTO poc_oidc_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(s.tokenHash,s.userId,s.expiresAt).run() }
  async getSession(tokenHash:string,now:number) { return this.db.prepare('SELECT token_hash AS tokenHash,user_id AS userId,expires_at AS expiresAt FROM poc_oidc_sessions WHERE token_hash=? AND expires_at>?').bind(tokenHash,now).first<Session>() }
  async deleteSession(tokenHash:string) { await this.db.prepare('DELETE FROM poc_oidc_sessions WHERE token_hash=?').bind(tokenHash).run() }
  async cleanup(now:number) { await this.db.batch([this.db.prepare('DELETE FROM poc_oidc_transactions WHERE expires_at<=?').bind(now),this.db.prepare('DELETE FROM poc_oidc_sessions WHERE expires_at<=?').bind(now)]) }
}
