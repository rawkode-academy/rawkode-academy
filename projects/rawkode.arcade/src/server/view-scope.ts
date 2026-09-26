import type { Principal, Role } from "../domain/protocol";
import type { Env } from "../env";
import { signJson, verifyJson } from "./crypto";

const cookieName = "arcade_view_scope";
type ViewRole = Extract<Role, "player" | "audience" | "display">;

interface ViewScope {
	roomId: string;
	principalId: string;
	role: ViewRole;
	teamId?: string;
	exp: number;
}

export async function issueViewScope(env: Env, roomId: string, principal: Principal): Promise<string | undefined> {
	if (principal.role !== "player" && principal.role !== "audience" && principal.role !== "display") return undefined;
	const token = await signJson({ roomId, principalId: principal.id, role: principal.role, teamId: principal.teamId, exp: Date.now() + 1000 * 60 * 30 } satisfies ViewScope, env.SESSION_SECRET);
	return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800`;
}

export async function readViewScope(request: Request, env: Env, roomId: string, principalId: string): Promise<ViewScope | undefined> {
	const match = request.headers.get("Cookie")?.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
	if (!match) return undefined;
	const scope = await verifyJson<ViewScope>(match[1], env.SESSION_SECRET);
	if (!scope || scope.exp <= Date.now() || scope.roomId !== roomId || scope.principalId !== principalId) return undefined;
	return scope;
}
