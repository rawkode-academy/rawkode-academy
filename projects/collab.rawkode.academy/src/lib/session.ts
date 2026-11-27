import type { Session } from "./types.ts";

export const COOKIE = "portal_session";
const SESSION_MAX_SECONDS = 60 * 60 * 24 * 7;
const LOGIN_TTL_SECONDS = 600;

export const cookieValue = (request: Request, name: string): string | null => {
	for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return rest.join("=");
	}
	return null;
};

export const sessionCookie = (request: Request, id: string, maxAge: number) =>
	`${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;

/** Sign-in state and sessions in KV. Sessions end when the access token does. */
export class SessionStore {
	constructor(private readonly kv: KVNamespace) {}

	putLogin(state: string, verifier: string) {
		return this.kv.put(`login:${state}`, verifier, { expirationTtl: LOGIN_TTL_SECONDS });
	}
	async takeLogin(state: string): Promise<string | null> {
		const verifier = await this.kv.get(`login:${state}`);
		if (verifier) await this.kv.delete(`login:${state}`);
		return verifier;
	}
	put(id: string, session: Session) {
		const seconds = Math.max(60, Math.min(SESSION_MAX_SECONDS, Math.floor((session.expiresAt - Date.now()) / 1000)));
		return this.kv.put(`session:${id}`, JSON.stringify(session), { expirationTtl: seconds });
	}
	async get(id: string): Promise<Session | null> {
		const session = (await this.kv.get(`session:${id}`, "json")) as Session | null;
		return session && session.expiresAt > Date.now() ? session : null;
	}
	delete(id: string) {
		return this.kv.delete(`session:${id}`);
	}
}
