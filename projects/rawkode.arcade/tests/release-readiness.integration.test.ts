import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import type { Principal } from "../src/protocol";
import { ContentRepository } from "../src/server/content";
import { signJson } from "../src/server/crypto";
import { RoomDirectory } from "../src/server/rooms";
import { verifyRoomTicket } from "../src/server/tickets";
import { migrateTestDatabase } from "./setup-d1";

const bindings = env as unknown as Env;
const directory = new RoomDirectory(bindings);

beforeAll(async () => {
	await migrateTestDatabase();
});

async function session(principal: Principal): Promise<string> {
	const token = await signJson({ ...principal, exp: Date.now() + 60_000 }, bindings.SESSION_SECRET);
	return `arcade_session=${token}`;
}

async function ownedRoom(principal: Principal, gameKey = "spinlock") {
	const record = await directory.create(gameKey, `Release ${crypto.randomUUID()}`, principal.id);
	await directory.admit(record.id, principal);
	const stub = directory.stub(record.id);
	await stub.fetch("https://game-room.internal/_internal/init", {
		method: "POST",
		body: JSON.stringify({ roomId: record.id, gameKey }),
	});
	return { record, stub };
}

describe("authoritative result and invitation boundaries", () => {
	it("bootstraps one load client through session, audience join, and the production socket", async () => {
		const host: Principal = { id: `load-host-${crypto.randomUUID()}`, role: "host", displayName: "Load Host" };
		const { record } = await ownedRoom(host, "null-pointer");
		const code = await directory.createInvite(record.id, "audience", new Date(Date.now() + 60_000).toISOString());
		const anonymous = await SELF.fetch("https://example.test/api/sessions/anonymous", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "load-0" }) });
		expect(anonymous.status).toBe(201);
		const cookie = anonymous.headers.get("set-cookie")?.split(";", 1)[0];
		expect(cookie).toBeTruthy();
		const admitted = await SELF.fetch(`https://example.test/api/join/${encodeURIComponent(code)}`, { method: "POST", headers: { "content-type": "application/json", cookie: cookie ?? "" }, body: JSON.stringify({ displayName: "load-0", desiredRole: "audience" }) });
		expect(admitted.status).toBe(200);
		const bootstrap = await admitted.json<{ roomId: string; role: string; wsTicket: string; socketUrl: string }>();
		expect(bootstrap).toMatchObject({ roomId: record.id, role: "audience", socketUrl: `/api/rooms/${record.id}/socket` });
		const protocol = `arcade-ticket.${bootstrap.wsTicket}`;
		const connected = await SELF.fetch(`https://example.test${bootstrap.socketUrl}`, { headers: { upgrade: "websocket", "sec-websocket-protocol": protocol } });
		expect(connected.status).toBe(101);
		expect(connected.headers.get("sec-websocket-protocol")).toBe(protocol);
		connected.webSocket?.accept();
		connected.webSocket?.close(1000, "load bootstrap complete");
	});

	it("does not expose the caller-supplied result projection route", async () => {
		const host: Principal = {
			id: `poison-host-${crypto.randomUUID()}`,
			role: "host",
			displayName: "Poison Test Host",
		};
		const { record } = await ownedRoom(host);
		const response = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(record.id)}/project-results`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: await session(host),
				},
				body: JSON.stringify({
					scores: [{ principalId: "attacker", teamId: "team-red", score: 999_999_999 }],
				}),
			},
		);
		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({
			error: { code: "NOT_FOUND" },
		});

		const effects = await bindings.DB.prepare(
			"SELECT (SELECT COUNT(*) FROM arcade_completed_games WHERE room_id = ?) AS completions, (SELECT COUNT(*) FROM arcade_results WHERE room_id = ?) AS results",
		)
			.bind(record.id, record.id)
			.first<{ completions: number; results: number }>();
		expect(effects).toEqual({ completions: 0, results: 0 });
	});

	it.each(["player", "display"] as const)(
		"lets a production host mint and redeem a %s invitation",
		async (role) => {
			const host: Principal = {
				id: `invite-host-${role}-${crypto.randomUUID()}`,
				role: "host",
				displayName: "Invitation Host",
			};
			const { record } = await ownedRoom(host);
			const created = await SELF.fetch(
				`https://example.test/api/rooms/${encodeURIComponent(record.id)}/invite`,
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						cookie: await session(host),
					},
					body: JSON.stringify({ role }),
				},
			);
			expect(created.status).toBe(201);
			const invitation = await created.json<{
				code: string;
				roomId: string;
				role: string;
			}>();
			expect(invitation).toMatchObject({ roomId: record.id, role });
			expect(invitation.code).toBeTruthy();

			const admitted = await SELF.fetch(
				`https://example.test/api/join/${encodeURIComponent(invitation.code)}`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						displayName: `${role} acceptance`,
						...(role === "player" ? { teamId: "team-red" } : {}),
					}),
				},
			);
			expect(admitted.status).toBe(200);
			const joined = await admitted.json<{
				roomId: string;
				role: string;
				wsTicket: string;
			}>();
			expect(joined).toMatchObject({ roomId: record.id, role });
			const ticket = await verifyRoomTicket(bindings, joined.wsTicket, record.id);
			expect(ticket?.principal).toMatchObject({
				role,
				...(role === "player" ? { teamId: "team-red" } : {}),
			});
		},
	);
});

describe("published content is selected and pinned per room", () => {
	it("uses the published revision for new gameplay without mutating an existing room", async () => {
		const producer: Principal = {
			id: `content-producer-${crypto.randomUUID()}`,
			role: "producer",
			displayName: "Content Producer",
		};
		const now = new Date().toISOString();
		await bindings.DB.prepare(
			"INSERT INTO arcade_operators (id, identity_subject, display_name, role, active, created_at, updated_at) VALUES (?, ?, ?, 'producer', 1, ?, ?)",
		)
			.bind(producer.id, producer.id, producer.displayName, now, now)
			.run();
		const content = new ContentRepository(bindings);
		const pack = await content.createPack(
			{
				gameKey: "merge-conflict",
				slug: `acceptance-${crypto.randomUUID()}`,
				title: "Immutable acceptance pack",
			},
			producer.id,
		);

		const firstPrompt = "Which production contract prevents a split brain?";
		const firstAnswer = "A pinned immutable revision";
		const first = await content.createRevision(
			pack.id,
			[
				{
					kind: "survey",
					prompt: firstPrompt,
					options: [{ answer: firstAnswer, points: 321 }],
					answer: firstAnswer,
				},
			],
			producer.id,
			{
				title: "Immutable v1",
				rounds: [
					{
						prompt: firstPrompt,
						answers: [{ answer: firstAnswer, points: 321 }],
					},
				],
			},
		);
		await content.publishRevision(first.id, producer.id);

		const cookie = await session(producer);
		const create = async (title: string, contentRevisionId?: string) => {
			const response = await SELF.fetch("https://example.test/api/rooms", {
				method: "POST",
				headers: { "content-type": "application/json", cookie },
				body: JSON.stringify({
					gameKey: "merge-conflict",
					title,
					...(contentRevisionId ? { contentRevisionId } : {}),
				}),
			});
			expect(response.status).toBe(201);
			return (await response.json<{ room: { id: string; contentRevisionId: string } }>()).room;
		};
		const start = async (roomId: string) => {
			const response = await SELF.fetch(
				`https://example.test/api/rooms/${encodeURIComponent(roomId)}/start`,
				{
					method: "POST",
					headers: { "content-type": "application/json", cookie },
					body: JSON.stringify({ expectedVersion: 0 }),
				},
			);
			expect(response.status).toBe(200);
		};
		const state = async (roomId: string) => {
			const response = await SELF.fetch(
				`https://example.test/api/rooms/${encodeURIComponent(roomId)}/state`,
				{ headers: { cookie } },
			);
			expect(response.status).toBe(200);
			return response.json<{
				state: {
					contentRevision?: { id: string; checksum: string };
					activePrompt?: { prompt: string };
				};
			}>();
		};

		const firstRoom = await create("Pinned v1", first.id);
		expect(firstRoom.contentRevisionId).toBe(first.id);
		await start(firstRoom.id);
		expect((await state(firstRoom.id)).state).toMatchObject({
			contentRevision: { id: first.id },
			activePrompt: { prompt: firstPrompt },
		});

		const secondPrompt = "Which revision should a newly created room use?";
		const second = await content.createRevision(
			pack.id,
			[
				{
					kind: "survey",
					prompt: secondPrompt,
					options: [{ answer: "The latest published revision", points: 123 }],
					answer: "The latest published revision",
				},
			],
			producer.id,
			{
				title: "Immutable v2",
				rounds: [
					{
						prompt: secondPrompt,
						answers: [{ answer: "The latest published revision", points: 123 }],
					},
				],
			},
		);
		await content.publishRevision(second.id, producer.id);

		// Publishing cannot rewrite the immutable snapshot already held by a room.
		expect((await state(firstRoom.id)).state).toMatchObject({
			contentRevision: { id: first.id },
			activePrompt: { prompt: firstPrompt },
		});

		const secondRoom = await create("Latest published");
		expect(secondRoom.contentRevisionId).toBe(second.id);
		await start(secondRoom.id);
		expect((await state(secondRoom.id)).state).toMatchObject({
			contentRevision: { id: second.id },
			activePrompt: { prompt: secondPrompt },
		});
	});
});
