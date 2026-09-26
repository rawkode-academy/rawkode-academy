import {
	expect,
	test,
	type APIRequestContext,
	type Browser,
	type BrowserContext,
	type Page,
} from "@playwright/test";

export type GameId =
	| "merge-conflict"
	| "spinlock"
	| "principal-engineer"
	| "race-condition"
	| "ten-nines"
	| "null-pointer";

export interface LiveRoom {
	host: Page;
	roomCode: string;
	roomId: string;
	privateMarker: string;
	codes: Record<"host" | "player" | "audience" | "display", string>;
	contexts: BrowserContext[];
	untrustedPages: Page[];
}

interface LeakProbe {
	secret: string;
	findings: string[];
	pending: Set<Promise<void>>;
	receivedSocketFrames: number;
	commandErrors: Map<string, { code: string; message: string }>;
}

const leakProbes = new WeakMap<Page, LeakProbe>();
const authoritativeSecretObserved = new WeakMap<Page, boolean>();

function watchForAuthoritativeSecret(page: Page, secret: string): void {
	authoritativeSecretObserved.set(page, false);
	page.on("websocket", (socket) => {
		socket.on("framereceived", ({ payload }) => {
			const body = typeof payload === "string" ? payload : payload.toString();
			if (body.includes(secret)) authoritativeSecretObserved.set(page, true);
		});
	});
}

function watchForSecret(page: Page, secret: string): void {
	const probe: LeakProbe = {
		secret,
		findings: [],
		pending: new Set(),
		receivedSocketFrames: 0,
		commandErrors: new Map(),
	};
	leakProbes.set(page, probe);
	page.on("response", (response) => {
		const pending = response
			.body()
			.then((body) => {
				if (body.includes(secret)) {
					probe.findings.push(`HTTP response leaked secret: ${response.url()}`);
				}
			})
			.catch(() => {})
			.finally(() => probe.pending.delete(pending));
		probe.pending.add(pending);
	});
	page.on("websocket", (socket) => {
		socket.on("framereceived", ({ payload }) => {
			probe.receivedSocketFrames += 1;
			const body = typeof payload === "string" ? payload : payload.toString();
			if (body.includes(secret)) {
				probe.findings.push(`WebSocket frame leaked secret: ${socket.url()}`);
			}
			try {
				const frame = JSON.parse(body);
				if (frame.type === "error" && typeof frame.commandId === "string" && typeof frame.code === "string" && typeof frame.message === "string") {
					probe.commandErrors.set(frame.commandId, { code: frame.code, message: frame.message });
				}
			} catch {
				// Non-JSON frames are still included in the raw secret audit above.
			}
		});
	});
}

export async function createSeededRoom(
	page: Page,
	request: APIRequestContext,
	gameId: GameId,
): Promise<LiveRoom> {
	const seedSecret = process.env.E2E_SEED_SECRET ?? "test-only-local-secret";
	const seededResponse = await request.post("/api/testing/seed", {
		headers: { "x-arcade-test-secret": seedSecret },
		data: { gameKey: gameId, title: `E2E ${gameId}` },
	});
	expect(seededResponse.status()).toBe(201);
	const seeded = (await seededResponse.json()) as {
		code: string;
		roomId: string;
		codes: Record<"host" | "player" | "audience" | "display", string>;
	};
	const privateMarker = "e2e-private-marker";
	watchForAuthoritativeSecret(page, privateMarker);
	await page.goto(
		`/host/${encodeURIComponent(seeded.roomId)}?code=${encodeURIComponent(seeded.codes.host)}`,
	);
	await expect(page).toHaveURL(
		new RegExp(`/host/${seeded.roomId}\\?code=${seeded.codes.host}$`),
	);
	await expect(page.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");
	await expect(page.getByTestId("host-private-answer")).toContainText(privateMarker);
	await expect
		.poll(() => authoritativeSecretObserved.get(page))
		.toBe(true);

	return {
		host: page,
		roomCode: seeded.code,
		roomId: seeded.roomId,
		privateMarker,
		codes: seeded.codes,
		contexts: [],
		untrustedPages: [],
	};
}

async function joinViaUi(
	page: Page,
	input: {
		code: string;
		name: string;
		expectedPath: string;
		teamId?: "team-red" | "team-blue";
	},
): Promise<void> {
	await page.goto("/join");
	await page.getByTestId("display-name").fill(input.name);
	await page.getByTestId("room-code-input").fill(input.code);
	// Leaving the code field loads the room's authoritative team roster.
	await page.getByTestId("room-code-input").press("Tab");
	if (input.teamId) {
		await expect(page.getByTestId(`team-choice-${input.teamId}`)).toBeVisible();
		await page.getByTestId(`team-choice-${input.teamId}`).click();
	}
	await page.getByTestId("join-room").click();
	await expect(page).toHaveURL(new RegExp(`${input.expectedPath}$`));
}

export async function openContestant(
	browser: Browser,
	room: LiveRoom,
	input: { name: string; teamId: "team-red" | "team-blue" },
): Promise<Page> {
	const context = await browser.newContext({ reducedMotion: "reduce" });
	room.contexts.push(context);
	const page = await context.newPage();
	watchForSecret(page, room.privateMarker);
	room.untrustedPages.push(page);

	await joinViaUi(page, {
		code: room.codes.player,
		name: input.name,
		teamId: input.teamId,
		expectedPath: `/play/${room.codes.player}`,
	});
	await expect(page.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");

	return page;
}

export async function openAudience(
	browser: Browser,
	room: LiveRoom,
): Promise<Page> {
	const context = await browser.newContext({ reducedMotion: "reduce" });
	room.contexts.push(context);
	const page = await context.newPage();
	watchForSecret(page, room.privateMarker);
	room.untrustedPages.push(page);
	await page.goto(`/audience/${encodeURIComponent(room.codes.audience)}`);
	await expect(page).toHaveURL(
		new RegExp(`/audience/${room.codes.audience}$`),
	);
	await expect(page.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");
	return page;
}

export async function openDisplay(
	browser: Browser,
	room: LiveRoom,
): Promise<Page> {
	const context = await browser.newContext({ reducedMotion: "reduce" });
	room.contexts.push(context);
	const page = await context.newPage();
	watchForSecret(page, room.privateMarker);
	room.untrustedPages.push(page);
	await page.goto(`/display/${encodeURIComponent(room.codes.display)}`);
	await expect(page).toHaveURL(new RegExp(`/display/${room.codes.display}$`));
	await expect(page.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");
	return page;
}

export async function start(room: LiveRoom): Promise<void> {
	await room.host.getByTestId("start-game").click();
	await expect(room.host.getByTestId("room-phase")).not.toHaveText("lobby");
	const phase = await room.host.getByTestId("room-phase").innerText();
	// Audience shards receive the new prompt asynchronously. Typing before
	// their snapshot arrives would be cleared by the prompt-change watcher.
	await Promise.all(room.untrustedPages.map((page) =>
		expect(page.getByTestId("room-phase")).toHaveText(phase),
	));
}

export async function expectSocketCommandError(page: Page, commandId: string, message: string): Promise<void> {
	const probe = leakProbes.get(page);
	expect(probe, "socket monitoring must start before role navigation").toBeDefined();
	await expect.poll(() => probe?.commandErrors.get(commandId)).toEqual({ code: "CONFLICT", message });
}

export async function closeRoom(room: LiveRoom): Promise<void> {
	await test.step("Audit live-role browsers before cleanup", async () => {
		for (const [index, page] of room.untrustedPages.entries()) {
			if (!page.isClosed()) {
				await test.step(`Audit live-role browser ${index + 1}`, () =>
					assertNoSecretInBrowser(page, room.privateMarker),
				);
			}
		}
	});
	console.info(`Live-room secret checks passed; closing ${room.contexts.length} role browser contexts`);
	await test.step("Close live-role browser contexts", async () => {
		await Promise.all(room.contexts.map((context, index) =>
			test.step(`Close live-role browser context ${index + 1}`, () => context.close()),
		));
	});
}

export async function assertNoSecretInBrowser(
	page: Page,
	secret: string,
): Promise<void> {
	const probe = leakProbes.get(page);
	expect(probe, "secret monitoring must start before role navigation").toBeDefined();
	expect(probe?.secret).toBe(secret);
	for (let attempt = 0; attempt < 5 && probe?.pending.size; attempt += 1) {
		await Promise.all([...probe.pending]);
	}
	expect(probe?.findings ?? []).toEqual([]);
	expect(
		probe?.receivedSocketFrames,
		"role must receive authoritative state over a production WebSocket",
	).toBeGreaterThan(0);
	expect(await page.locator("html").innerText()).not.toContain(secret);
	const documentMarkup = await page.content();
	expect(documentMarkup).not.toContain(secret);
	const storage = await page.evaluate(() => ({
		local: { ...localStorage },
		session: { ...sessionStorage },
	}));
	expect(JSON.stringify(storage)).not.toContain(secret);
}

export async function completeGame(
	room: LiveRoom,
	display: Page,
	teamId = "team-red",
): Promise<void> {
	const finalScore = (await display.getByTestId(`score-${teamId}`).innerText()).trim();
	await room.host.getByTestId("complete-game").click();
	await expect(room.host.getByTestId("game-complete")).toBeVisible();
	await expect(display.getByTestId("game-complete")).toBeVisible();
	await display.goto(
		`/leaderboards?roomId=${encodeURIComponent(room.roomId)}&fresh=${Date.now()}`,
	);
	const projected = display.getByTestId(
		`leaderboard-row-${room.roomId}-${teamId}`,
	);
	await expect(projected).toBeVisible();
	await expect(display.getByTestId("leaderboard-room-id")).toContainText(room.roomId);
	await expect(projected).toContainText(finalScore);
}
