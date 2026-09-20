import type { Principal, Role } from "../domain/protocol";
import type { Env } from "../env";
import { randomId, signJson, verifyJson } from "./crypto";
import { authenticateAccess } from "./access";

interface SessionPayload extends Principal { exp: number; }

const sessionCookie = "arcade_session";

export async function createAnonymousSession(env: Env, displayName = "Anonymous developer"): Promise<{ principal: Principal; cookie: string }> {
	const principal: Principal = { id: randomId("player"), role: "audience", displayName: displayName.slice(0, 80) };
	const token = await signJson({ ...principal, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }, env.SESSION_SECRET);
	return { principal, cookie: `${sessionCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800` };
}

export async function authenticate(request: Request, env: Env): Promise<Principal | undefined> {
	const access = await authenticateAccess(request, env);
	if (access) return access;
	const match = request.headers.get("Cookie")?.match(new RegExp(`(?:^|;\\s*)${sessionCookie}=([^;]+)`));
	if (!match) return undefined;
	const payload = await verifyJson<SessionPayload>(match[1], env.SESSION_SECRET);
	if (!payload || payload.exp <= Date.now()) return undefined;
	return { id: payload.id, role: payload.role, teamId: payload.teamId, displayName: payload.displayName };
}

export function hasRole(principal: Principal | undefined, roles: Role[]): principal is Principal {
	return Boolean(principal && roles.includes(principal.role));
}
