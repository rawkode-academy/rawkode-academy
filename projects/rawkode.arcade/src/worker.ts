import { AudienceShard } from "./durable-objects/audience-shard";
import { GameRoom } from "./durable-objects/game-room";
import type { CommandEnvelope, Principal, Role } from "./protocol";
import type { Env } from "./env";
import { authenticate, createAnonymousSession, hasRole } from "./server/auth";
import { ContentRepository, type ContentQuestionInput } from "./server/content";
import { Leaderboards } from "./server/leaderboards";
import { ModerationService } from "./server/moderation";
import { ResultProjector } from "./server/results";
import { RoomDirectory } from "./server/rooms";
import { issueRoomTicket, verifyRoomTicket } from "./server/tickets";
import { issueViewScope, readViewScope } from "./server/view-scope";

export { GameRoom, AudienceShard };

const apiPrefixes = ["/api/", "/api/v1/"];

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
	const responseHeaders = new Headers(headers);
	responseHeaders.set("cache-control", "no-store");
	return Response.json(data, { status, headers: responseHeaders });
}

function badRequest(message: string): Response { return json({ error: { code: "BAD_REQUEST", message } }, 400); }

function routePath(pathname: string): string | undefined {
	for (const prefix of apiPrefixes) if (pathname.startsWith(prefix)) return `/${pathname.slice(prefix.length)}`;
	return undefined;
}

async function requestJson<T>(request: Request): Promise<T | undefined> {
	if (Number(request.headers.get("content-length") ?? 0) > 32_768) return undefined;
	try { return await request.json<T>(); } catch { return undefined; }
}

function doHeaders(principal: Principal): Headers { return new Headers({ "x-arcade-principal": JSON.stringify(principal) }); }

function publicPrincipal(): Principal { return { id: "public-audience", role: "audience", displayName: "Audience" }; }
async function downscopedPrincipal(request: Request, env: Env, roomId: string, principal: Principal | undefined, membership: { role: Role; teamId?: string; displayName?: string } | undefined): Promise<Principal | undefined> {
	if (!principal || !membership) return undefined;
	const requested = request.headers.get("x-arcade-view-role");
	// A membership can only deliberately reduce its browser view. It can never
	// elevate via a caller-controlled header, and host navigation without it
	// retains the privileged canonical role.
	if (membership.role === "host" || membership.role === "producer" || membership.role === "moderator") {
		if (requested === "audience" || requested === "display") return { ...principal, role: requested };
		if (requested === "player") {
			const scope = await readViewScope(request, env, roomId, principal.id);
			// A player view gets its team only from the signed join scope. An
			// absent/forged scope must never fall through to a host snapshot.
			return scope?.role === "player" ? { ...principal, role: "player", teamId: scope.teamId } : undefined;
		}
	}
	return { ...principal, role: membership.role, teamId: membership.teamId, displayName: membership.displayName ?? principal.displayName };
}
function admissionOpen(env: Env): boolean { return env.ADMISSION_ENABLED !== "false"; }

/** Stable, non-secret partitioning. The actor name is authoritative and hello confirms it to clients. */
function audienceShardId(roomId: string, principalId: string): string {
	let hash = 2_166_136_261;
	for (const character of `${roomId}:${principalId}`) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16_777_619); }
	return String((hash >>> 0) % 32);
}

function webSocketTicket(request: Request): string | null {
	const queryTicket = new URL(request.url).searchParams.get("ticket");
	if (queryTicket) return queryTicket;
	for (const value of request.headers.get("Sec-WebSocket-Protocol")?.split(",") ?? []) {
		const protocol = value.trim();
		if (protocol.startsWith("arcade-ticket.")) return protocol.slice("arcade-ticket.".length);
	}
	return null;
}

async function api(request: Request, env: Env, ctx: ExecutionContext, path: string): Promise<Response> {
	const principal = await authenticate(request, env);
	const directory = new RoomDirectory(env);
	const content = new ContentRepository(env);

	if (path === "/games" && request.method === "GET") return json({ games: content.listGames() });
	if (path === "/content/packs" && request.method === "GET") {
		if (!hasRole(principal, ["producer", "host", "moderator"])) return json({ error: { code: "FORBIDDEN", message: "Operator role required" } }, 403);
		return json({ packs: await content.listPacks(new URL(request.url).searchParams.get("gameKey") ?? undefined) });
	}
	if (path === "/content/packs" && request.method === "POST") {
		if (!hasRole(principal, ["producer", "host"])) return json({ error: { code: "FORBIDDEN", message: "Producer role required" } }, 403);
		const body = await requestJson<{ gameKey: string; slug: string; title: string; description?: string }>(request);
		if (!body) return badRequest("A pack is required");
		try { return json(await content.createPack(body, principal.id), 201); } catch (error) { return badRequest(error instanceof Error ? error.message : "Invalid pack"); }
	}
	const packRoute = path.match(/^\/content\/packs\/([^/]+)(?:\/(revisions))?$/);
	if (packRoute && request.method === "GET" && !packRoute[2]) {
		if (!hasRole(principal, ["producer", "host", "moderator"])) return json({ error: { code: "FORBIDDEN", message: "Operator role required" } }, 403);
		const pack = await content.getPack(decodeURIComponent(packRoute[1]));
		return pack ? json({ pack }) : json({ error: { code: "NOT_FOUND", message: "Pack not found" } }, 404);
	}
	if (packRoute && (request.method === "PATCH" || request.method === "DELETE") && !packRoute[2]) {
		if (!hasRole(principal, ["producer", "host"])) return json({ error: { code: "FORBIDDEN", message: "Producer role required" } }, 403);
		try {
			if (request.method === "DELETE") await content.archivePack(decodeURIComponent(packRoute[1]));
			else { const body = await requestJson<{ title: string; description?: string }>(request); if (!body) return badRequest("A title is required"); await content.updatePack(decodeURIComponent(packRoute[1]), body); }
			return json({ ok: true });
		} catch (error) { return badRequest(error instanceof Error ? error.message : "Invalid pack"); }
	}
	if (packRoute && request.method === "POST" && packRoute[2] === "revisions") {
		if (!hasRole(principal, ["producer", "host"])) return json({ error: { code: "FORBIDDEN", message: "Producer role required" } }, 403);
		const body = await requestJson<{ questions: ContentQuestionInput[]; manifest?: Record<string, unknown> }>(request);
		if (!body?.questions) return badRequest("Questions are required");
		try { return json(await content.createRevision(decodeURIComponent(packRoute[1]), body.questions, principal.id, body.manifest), 201); } catch (error) { return badRequest(error instanceof Error ? error.message : "Invalid revision"); }
	}
	const publishRoute = path.match(/^\/content\/revisions\/([^/]+)\/publish$/);
	const revisionRoute = path.match(/^\/content\/revisions\/([^/]+)$/);
	if (revisionRoute && request.method === "GET") {
		if (!hasRole(principal, ["producer", "host", "moderator"])) return json({ error: { code: "FORBIDDEN", message: "Operator role required" } }, 403);
		const revision = await content.getRevision(decodeURIComponent(revisionRoute[1]));
		return revision ? json({ revision }) : json({ error: { code: "NOT_FOUND", message: "Revision not found" } }, 404);
	}
	if (publishRoute && request.method === "POST") {
		if (!hasRole(principal, ["producer", "host"])) return json({ error: { code: "FORBIDDEN", message: "Producer role required" } }, 403);
		try { await content.publishRevision(decodeURIComponent(publishRoute[1]), principal.id); return json({ ok: true }); } catch (error) { return badRequest(error instanceof Error ? error.message : "Invalid revision"); }
	}
	if (path === "/content/assets" && request.method === "POST") {
		if (!hasRole(principal, ["producer", "host"])) return json({ error: { code: "FORBIDDEN", message: "Producer role required" } }, 403);
		try { return json(await content.putAsset(await request.arrayBuffer(), request.headers.get("content-type") ?? "", principal.id), 201); } catch (error) { return badRequest(error instanceof Error ? error.message : "Invalid asset"); }
	}
	if (path === "/sessions/anonymous" && request.method === "POST") {
		const body = await requestJson<{ displayName?: string }>(request);
		const session = await createAnonymousSession(env, body?.displayName);
		return json({ principal: session.principal }, 201, { "set-cookie": session.cookie });
	}
	if (path === "/testing/seed" && request.method === "POST") {
		// Never enable deterministic rooms outside the isolated test deployment.
		if (env.ENVIRONMENT !== "test" || !env.E2E_SEED_SECRET || request.headers.get("x-arcade-test-secret") !== env.E2E_SEED_SECRET) return json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
		const body = await requestJson<{ gameKey?: string; title?: string }>(request);
		const gameKey = body?.gameKey && content.getGame(body.gameKey) ? body.gameKey : "merge-conflict";
		const seededAnswer: Record<string, string> = { "merge-conflict": "git blame", spinlock: "Works on my machine", "principal-engineer": "B", "race-condition": "Race", "ten-nines": "200", "null-pointer": "Zig" };
		const promptId = gameKey === "null-pointer" ? "e2e-null-pointer" : "e2e-prompt";
		const host: Principal = { id: "e2e-host", role: "host", displayName: "E2E Host" };
		const room = await directory.create(gameKey, body?.title ?? "E2E seeded room", host.id);
		await directory.admit(room.id, host);
		const stub = directory.stub(room.id);
		await stub.fetch("https://game-room.internal/_internal/init", { method: "POST", body: JSON.stringify({ roomId: room.id, gameKey }) });
		const headers = doHeaders(host); headers.set("content-type", "application/json");
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers, body: JSON.stringify({ v: 1, id: crypto.randomUUID(), type: "prompt.open", expectedVersion: 0, payload: { id: promptId, prompt: "E2E question", choices: [{ id: "git-blame", label: "git blame" }, { id: "b", label: "b" }], answer: seededAnswer[gameKey], e2ePrivateMarker: "e2e-private-marker" }, sentAt: new Date().toISOString() }) });
		const codes = Object.fromEntries(await Promise.all((["host", "player", "audience", "display"] as Role[]).map(async (role) => [role, await directory.createInvite(room.id, role, new Date(Date.now() + 15 * 60_000).toISOString())])));
		// The marker is intentionally not returned: only the host's role-redacted WebSocket snapshot contains it.
		return json({ code: room.id, roomId: room.id, socketUrl: `/api/rooms/${room.id}/socket`, codes }, 201);
	}
	if (path === "/rooms" && request.method === "POST") {
		if (!admissionOpen(env)) return json({ error: { code: "ADMISSION_CLOSED", message: "New rooms are temporarily disabled" } }, 503);
		if (!hasRole(principal, ["host", "producer"])) return json({ error: { code: "FORBIDDEN", message: "Host or producer session required" } }, 403);
		const body = await requestJson<{ gameKey: string; title: string; contentRevisionId?: string }>(request);
		if (!body?.gameKey || !body.title || !content.getGame(body.gameKey)) return badRequest("A known gameKey and title are required");
		const revision = await content.publishedRoomContent(body.gameKey, body.contentRevisionId);
		if (body.contentRevisionId && !revision) return badRequest("The requested content revision is not published for this game");
		// Built-in game content remains available for a game with no authored pack;
		// once a published revision exists it is automatically pinned below.
		const room = await directory.create(body.gameKey, body.title, principal.id, revision?.revisionId);
		await directory.admit(room.id, principal);
		await directory.stub(room.id).fetch("https://game-room.internal/_internal/init", { method: "POST", body: JSON.stringify({ roomId: room.id, gameKey: room.gameKey, content: revision }) });
		return json({ room }, 201);
	}

	const roomMatch = path.match(/^\/rooms\/([^/]+)(?:\/(.*))?$/);
	if (!roomMatch) {
		const leaderboard = path.match(/^\/leaderboards\/([^/]+)$/);
		if (leaderboard && request.method === "GET") return json({ entries: await new Leaderboards(env).forGame(decodeURIComponent(leaderboard[1])) });
		if (path === "/leaderboards" && request.method === "GET") {
			const gameKey = new URL(request.url).searchParams.get("gameKey") ?? "merge-conflict";
			return json({ gameKey, entries: await new Leaderboards(env).forGame(gameKey) });
		}
		const join = path.match(/^\/join\/([^/]+)$/);
		if (join && (request.method === "GET" || request.method === "POST")) {
			if (!admissionOpen(env)) return json({ error: { code: "ADMISSION_CLOSED", message: "Joining is temporarily disabled" } }, 503);
			const joinInput = request.method === "POST" ? await requestJson<{ displayName?: string; teamId?: string }>(request) : undefined;
			const code = decodeURIComponent(join[1]);
			let joiningPrincipal = principal;
			let cookie: string | undefined;
			if (!joiningPrincipal) { const session = await createAnonymousSession(env, joinInput?.displayName); joiningPrincipal = session.principal; cookie = session.cookie; }
			const invite = await directory.consumeInvite(code, joiningPrincipal.id);
			const canonicalRoom = invite ? undefined : await directory.get(code);
			const canonicalMembership = canonicalRoom ? await directory.membership(code, joiningPrincipal.id) : undefined;
			const target = invite ?? (canonicalRoom ? { roomId: code, role: canonicalMembership?.role ?? "audience" as Role } : undefined);
			if (!target) return json({ error: { code: "NOT_FOUND", message: "Invite is invalid or expired" } }, 404);
			const existingMembership = canonicalMembership ?? await directory.membership(target.roomId, joiningPrincipal.id);
			const existingPrivileged = existingMembership && ["host", "producer", "moderator"].includes(existingMembership.role);
			const requestedPrivileged = ["host", "producer", "moderator"].includes(target.role);
			// A canonical room rejoin restores the durable privileged scope. Redeeming
			// a lower-scoped invite issues only that invite's role without demoting it.
			const role = !invite && existingPrivileged ? existingMembership.role : target.role;
			const teamId = role === "player" && ["team-red", "team-blue"].includes(joinInput?.teamId ?? "") ? joinInput?.teamId : (!invite ? existingMembership?.teamId : undefined);
			const scopedPrincipal: Principal = { ...joiningPrincipal, role, teamId, displayName: joinInput?.displayName?.slice(0, 80) || (!invite ? existingMembership?.displayName : undefined) || joiningPrincipal.displayName };
			// An operator may intentionally open an audience/display invite in the
			// same browser. Issue that scoped ticket, but never demote their durable
			// room membership or strand host/recovery access.
			if (!existingPrivileged || requestedPrivileged) await directory.admit(target.roomId, scopedPrincipal);
			const ticket = await issueRoomTicket(env, target.roomId, scopedPrincipal);
			const viewCookie = await issueViewScope(env, target.roomId, scopedPrincipal);
			// The client sends wsTicket in Sec-WebSocket-Protocol; keep credentials out of logs and URLs.
			const headers = new Headers();
			if (cookie) headers.append("set-cookie", cookie);
			if (viewCookie) headers.append("set-cookie", viewCookie);
			return json({ roomId: target.roomId, wsTicket: ticket, ticket, socketUrl: `/api/rooms/${target.roomId}/socket`, role, expiresIn: 300 }, 200, headers);
		}
		return json({ error: { code: "NOT_FOUND", message: "API route not found" } }, 404);
	}
	const roomId = decodeURIComponent(roomMatch[1]);
	const action = roomMatch[2] ?? "";
	const room = await directory.get(roomId);
	if (!room) return json({ error: { code: "NOT_FOUND", message: "Room not found" } }, 404);
	const stub = directory.stub(roomId);
	const membership = principal ? await directory.membership(roomId, principal.id) : undefined;
	const roomPrincipal = await downscopedPrincipal(request, env, roomId, principal, membership);

	if (action === "" && request.method === "GET") return json({ room });
	if (action === "membership" && request.method === "GET") {
		if (!roomPrincipal) return json({ error: { code: "FORBIDDEN", message: "Join this room first" } }, 403);
		return json({ role: roomPrincipal.role, teamId: roomPrincipal.teamId, displayName: roomPrincipal.displayName });
	}
	if (action === "presence" && request.method === "GET") {
		if (!hasRole(roomPrincipal, ["host", "producer", "moderator"])) return json({ error: { code: "FORBIDDEN", message: "Host, producer or moderator membership required" } }, 403);
		return json({ roomId, presence: await directory.presence(roomId) });
	}

	if (action === "state" && request.method === "GET") {
		const viewer = roomPrincipal ?? publicPrincipal();
		const response = await stub.fetch("https://game-room.internal/_internal/state", { headers: doHeaders(viewer) });
		return response;
	}
	if ((action === "tickets" || action === "ws-ticket") && request.method === "POST") {
		if (!admissionOpen(env)) return json({ error: { code: "ADMISSION_CLOSED", message: "New sessions are temporarily disabled" } }, 503);
		if (!principal) return json({ error: { code: "UNAUTHORIZED", message: "A session is required" } }, 401);
		if (!roomPrincipal) return json({ error: { code: "FORBIDDEN", message: "Join this room before requesting a ticket" } }, 403);
		return json({ ticket: await issueRoomTicket(env, roomId, roomPrincipal), expiresIn: 300 });
	}
	if (action === "socket" && request.method === "GET") {
		if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected websocket upgrade", { status: 426 });
		const ticket = await verifyRoomTicket(env, webSocketTicket(request), roomId);
		if (!ticket) return new Response("Invalid or expired ticket", { status: 401 });
		const headers = new Headers(request.headers);
		headers.set("x-arcade-principal", JSON.stringify(ticket.principal));
		headers.set("x-arcade-ticket-nonce", ticket.nonce);
		if (ticket.principal.role === "audience") {
			const shardId = audienceShardId(roomId, ticket.principal.id);
			headers.set("x-arcade-room-id", roomId);
			headers.set("x-arcade-shard-id", shardId);
			const shard = env.AUDIENCE_SHARD.get(env.AUDIENCE_SHARD.idFromName(`${roomId}:audience:${shardId}`));
			return shard.fetch(new Request("https://audience-shard.internal/_internal/connect", { headers }));
		}
		return stub.fetch(new Request("https://game-room.internal/_internal/connect", { headers }));
	}
	if ((action === "leaderboard" || action === "results") && request.method === "GET") return json({ roomId, entries: await new Leaderboards(env).forRoom(roomId) });
	if (action === "commands" && request.method === "POST") {
		if (!principal) return json({ error: { code: "UNAUTHORIZED", message: "A session is required" } }, 401);
		if (!roomPrincipal) return json({ error: { code: "FORBIDDEN", message: "Join this room before sending commands" } }, 403);
		const command = await requestJson<CommandEnvelope>(request);
		if (!command) return badRequest("A command envelope is required");
		if (!command.id || typeof command.id !== "string" || command.id.trim().length === 0) return badRequest("A command id is required");
		if (command.type === "audience.vote" || command.type === "audience.reaction") {
			if (roomPrincipal.role !== "audience") return json({ error: { code: "FORBIDDEN", message: "Audience role required" } }, 403);
			const audiencePayload = command.payload as { choice?: string; reaction?: string; promptId?: string };
			const choice = audiencePayload?.choice;
			if (command.type === "audience.vote" && !choice) return badRequest("Audience vote requires a choice");
			const shardId = audienceShardId(roomId, principal.id);
			const shard = env.AUDIENCE_SHARD.get(env.AUDIENCE_SHARD.idFromName(`${roomId}:audience:${shardId}`));
			if (command.type === "audience.reaction") return shard.fetch("https://audience-shard.internal/_internal/submit-reaction", { method: "POST", headers: doHeaders(roomPrincipal), body: JSON.stringify({ roomId, reaction: audiencePayload.reaction ?? "like", promptId: audiencePayload.promptId ?? "live", shardId, commandId: command.id }) });
			return shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: doHeaders(roomPrincipal), body: JSON.stringify({ roomId, choice, promptId: audiencePayload.promptId ?? "default", shardId, commandId: command.id }) });
		}
		const headers = doHeaders(roomPrincipal);
		headers.set("content-type", "application/json");
		return stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers, body: JSON.stringify(command) });
	}
	if (action === "start" && request.method === "POST") {
		if (!hasRole(roomPrincipal, ["host", "producer"])) return json({ error: { code: "FORBIDDEN", message: "Host or producer membership required" } }, 403);
		const body = await requestJson<{ expectedVersion: number; id?: string }>(request);
		if (!body || !Number.isInteger(body.expectedVersion)) return badRequest("expectedVersion is required");
		const headers = doHeaders(roomPrincipal);
		headers.set("content-type", "application/json");
		return stub.fetch("https://game-room.internal/_internal/command", {
			method: "POST", headers,
			body: JSON.stringify({ v: 1, id: body.id ?? crypto.randomUUID(), type: "room.start", expectedVersion: body.expectedVersion, payload: {}, sentAt: new Date().toISOString() }),
		});
	}
	if (action === "invite" && request.method === "POST") {
		if (!hasRole(roomPrincipal, ["host", "producer"])) return json({ error: { code: "FORBIDDEN", message: "Host or producer membership required" } }, 403);
		const body = await requestJson<{ role?: "player" | "audience" | "display"; expiresInSeconds?: number }>(request);
		const lifetime = Math.min(Math.max(body?.expiresInSeconds ?? 3_600, 60), 86_400);
		const code = await directory.createInvite(roomId, body?.role ?? "audience", new Date(Date.now() + lifetime * 1000).toISOString());
		return json({ code, roomId, role: body?.role ?? "audience", expiresInSeconds: lifetime }, 201);
	}
	if (action === "moderation" && request.method === "POST") {
		if (!hasRole(roomPrincipal, ["host", "producer", "moderator"])) return json({ error: { code: "FORBIDDEN", message: "Moderator role required" } }, 403);
		const body = await requestJson<{ action: string; targetId?: string; reason?: string }>(request);
		if (!body?.action) return badRequest("An action is required");
		await new ModerationService(env).record(roomId, roomPrincipal.id, body.action, body.targetId, body.reason);
		return json({ ok: true }, 201);
	}
	if (action === "project-outbox" && request.method === "POST") {
		if (!hasRole(roomPrincipal, ["host", "producer"])) return json({ error: { code: "FORBIDDEN", message: "Producer role required" } }, 403);
		return json({ projected: await new ResultProjector(env).consumeOutbox() });
	}
	return json({ error: { code: "NOT_FOUND", message: "Room route not found" } }, 404);
}

export const arcadeWorker = {
	async fetch(request, env, ctx): Promise<Response> {
		const path = routePath(new URL(request.url).pathname);
		if (path) return api(request, env, ctx, path);
		if (new URL(request.url).pathname === "/health") return json({ ok: true, service: "rawkode-arcade" });
		const { handle } = await import("@astrojs/cloudflare/handler");
		return handle(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;

export default arcadeWorker;
