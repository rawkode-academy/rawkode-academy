/**
 * Production WebSocket audience rehearsal for Rawkode Arcade.
 *
 * The runner creates one signed anonymous session, joins it through an audience
 * invite, consumes one single-use room ticket per socket, and sends one real
 * audience vote per identity against the room's authoritative active prompt.
 * It fails closed if the server does not confirm actual shard placement, if
 * commands are rejected, if a connection drops, or if the full connection
 * hold duration is not completed.
 */

import { ProbeLedger, type ProbeSummary } from "./load-rehearsal-metrics";

interface Config {
	baseUrl: URL;
	roomId: string;
	inviteCode: string;
	sessionUrl: URL;
	joinUrl: URL;
	socketUrl: URL;
	clients: number;
	shards: number;
	durationMs: number;
	connectConcurrency: number;
	requestTimeoutMs: number;
	connectTimeoutMs: number;
	probeEveryMs: number;
	acceptanceTimeoutMs: number;
	visibilityTimeoutMs: number;
	acceptanceP95BudgetMs: number;
	visibilityP95BudgetMs: number;
	processCount: number;
	processIndex: number;
	probePayload: Record<string, unknown>;
	promptId?: string;
	synchronizedBurst: boolean;
}

interface TicketResponse {
	ticket?: string;
	wsTicket?: string;
	url?: string;
	wsUrl?: string;
	shardId?: string;
	roomId?: string;
	role?: string;
}

interface ClientRecord {
	globalIndex: number;
	actorId: string;
	socket?: WebSocket;
	openedAt?: number;
	closedAt?: number;
	closeCode?: number;
	error?: string;
	expectedVersion?: number;
	actualShard?: string;
	activePromptId?: string;
	probeSent?: boolean;
	pendingProbe?: {
		id: string;
		promptId: string;
		acceptanceTimeout: ReturnType<typeof setTimeout>;
		visibilityTimeout: ReturnType<typeof setTimeout>;
	};
}

interface Summary {
	type: "rawkode-arcade-load-summary";
	startedAt: string;
	finishedAt: string;
	measurement: {
		startedAt: string | null;
		finishedAt: string | null;
		requiredDurationMs: number;
		actualDurationMs: number;
		completed: boolean;
	};
	process: { index: number; count: number };
	target: { globalClients: number; localClients: number; shards: number };
	connections: {
		opened: number;
		openAtEnd: number;
		failed: number;
		unexpectedlyClosed: number;
	};
	probes: ProbeSummary & {
		semantics: {
			acceptance: string;
			aggregateCommitVisibility: string;
			publicSnapshotFanout: "not-correlatable";
		};
	};
	observedShardConnections: Record<string, number>;
	gates: {
		fullDurationCompleted: boolean;
		allConnectionsOpened: boolean;
		allShardsObserved: boolean;
		acceptanceP95WithinBudget: boolean;
		aggregateVisibilityP95WithinBudget: boolean;
		acceptanceCoverageAtLeast95Percent: boolean;
		aggregateVisibilityCoverageAtLeast95Percent: boolean;
		allPlannedVotesSent: boolean;
		acceptanceTimeoutRateAtMost1Percent: boolean;
		aggregateVisibilityTimeoutRateAtMost1Percent: boolean;
		noRejectedProbes: boolean;
		passed: boolean;
	};
}

function integer(name: string, fallback: number, minimum = 0): number {
	const raw = process.env[name];
	const parsed = raw === undefined ? fallback : Number.parseInt(raw, 10);
	if (!Number.isSafeInteger(parsed) || parsed < minimum) {
		throw new Error(`${name} must be an integer >= ${minimum}; received ${raw}`);
	}
	return parsed;
}

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function boolean(name: string, fallback: boolean): boolean {
	const value = process.env[name]?.trim().toLowerCase();
	if (value === undefined || value === "") return fallback;
	if (value === "true" || value === "1") return true;
	if (value === "false" || value === "0") return false;
	throw new Error(`${name} must be true, false, 1, or 0; received ${value}`);
}

function readConfig(): Config {
	const baseUrl = new URL(required("ARCADE_LOAD_BASE_URL"));
	if (!/^https?:$/.test(baseUrl.protocol)) {
		throw new Error("ARCADE_LOAD_BASE_URL must use http or https");
	}
	const roomId = required("ARCADE_LOAD_ROOM_ID");
	const inviteCode = required("ARCADE_LOAD_INVITE_CODE");
	const processCount = integer("ARCADE_LOAD_PROCESS_COUNT", 1, 1);
	const processIndex = integer("ARCADE_LOAD_PROCESS_INDEX", 0);
	if (processIndex >= processCount) {
		throw new Error("ARCADE_LOAD_PROCESS_INDEX must be less than process count");
	}

	let probePayload: Record<string, unknown> = { choice: "Java" };
	if (process.env.ARCADE_LOAD_PROBE_PAYLOAD_JSON) {
		const parsed = JSON.parse(process.env.ARCADE_LOAD_PROBE_PAYLOAD_JSON);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("ARCADE_LOAD_PROBE_PAYLOAD_JSON must be a JSON object");
		}
		probePayload = parsed;
	}
	if (
		typeof probePayload.choice !== "string" ||
		!probePayload.choice.trim() ||
		probePayload.choice.length > 100
	) {
		throw new Error(
			"ARCADE_LOAD_PROBE_PAYLOAD_JSON must contain a non-empty choice of at most 100 characters",
		);
	}

	return {
		baseUrl,
		roomId,
		inviteCode,
		sessionUrl: new URL(
			process.env.ARCADE_LOAD_SESSION_URL ?? "/api/sessions/anonymous",
			baseUrl,
		),
		joinUrl: new URL(
			process.env.ARCADE_LOAD_JOIN_URL ?? `/api/join/${encodeURIComponent(inviteCode)}`,
			baseUrl,
		),
		socketUrl: new URL(
			process.env.ARCADE_LOAD_SOCKET_URL ?? `/api/rooms/${roomId}/socket`,
			baseUrl,
		),
		clients: integer("ARCADE_LOAD_CLIENTS", 4_000, 1),
		shards: integer("ARCADE_LOAD_SHARDS", 32, 1),
		durationMs: integer("ARCADE_LOAD_DURATION_SECONDS", 1_800, 1) * 1_000,
		connectConcurrency: integer("ARCADE_LOAD_CONNECT_CONCURRENCY", 200, 1),
		requestTimeoutMs: integer("ARCADE_LOAD_REQUEST_TIMEOUT_MS", 15_000, 1),
		connectTimeoutMs: integer("ARCADE_LOAD_CONNECT_TIMEOUT_MS", 15_000, 1),
		probeEveryMs: integer("ARCADE_LOAD_PROBE_EVERY_MS", 5_000, 250),
		acceptanceTimeoutMs: integer(
			"ARCADE_LOAD_ACCEPTANCE_TIMEOUT_MS",
			integer("ARCADE_LOAD_PROBE_TIMEOUT_MS", 2_000, 100),
			100,
		),
		visibilityTimeoutMs: integer(
			"ARCADE_LOAD_VISIBILITY_TIMEOUT_MS",
			integer("ARCADE_LOAD_PROBE_TIMEOUT_MS", 2_000, 100),
			100,
		),
		acceptanceP95BudgetMs: integer(
			"ARCADE_LOAD_ACCEPTANCE_P95_BUDGET_MS",
			integer("ARCADE_LOAD_P95_BUDGET_MS", 250, 1),
			1,
		),
		visibilityP95BudgetMs: integer(
			"ARCADE_LOAD_VISIBILITY_P95_BUDGET_MS",
			integer("ARCADE_LOAD_P95_BUDGET_MS", 250, 1),
			1,
		),
		processCount,
		processIndex,
		probePayload,
		promptId: process.env.ARCADE_LOAD_PROMPT_ID?.trim() || undefined,
		synchronizedBurst: boolean("ARCADE_LOAD_SYNCHRONIZED_BURST", false),
	};
}

const settings = readConfig();
const runStartedAt = new Date();
const runStartedPerformance = performance.now();
let measurementStartedAt: number | undefined;
let measurementFinishedAt: number | undefined;
let measurementCompleted = false;
let interrupted = false;
const clients: ClientRecord[] = [];
for (
	let globalIndex = settings.processIndex;
	globalIndex < settings.clients;
	globalIndex += settings.processCount
) {
	clients.push({ globalIndex, actorId: `load-${globalIndex}` });
}

const probeLedger = new ProbeLedger();
let probeSequence = 0;

function wallClock(performanceTimestamp: number | undefined): string | null {
	if (performanceTimestamp === undefined) return null;
	return new Date(
		runStartedAt.getTime() + performanceTimestamp - runStartedPerformance,
	).toISOString();
}

function cookieFrom(response: Response): string {
	const value = response.headers.get("set-cookie")?.split(";", 1)[0];
	if (!value) throw new Error("session response did not set the signed session cookie");
	return value;
}

async function createSession(client: ClientRecord): Promise<string> {
	const response = await fetch(settings.sessionUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ displayName: client.actorId }),
		signal: AbortSignal.timeout(settings.requestTimeoutMs),
	});
	if (!response.ok) {
		throw new Error(
			`session endpoint returned ${response.status}: ${await response.text()}`,
		);
	}
	return cookieFrom(response);
}

async function joinRoom(
	client: ClientRecord,
	cookie: string,
): Promise<TicketResponse> {
	const response = await fetch(settings.joinUrl, {
		method: "POST",
		headers: { "content-type": "application/json", cookie },
		body: JSON.stringify({ displayName: client.actorId, desiredRole: "audience" }),
		signal: AbortSignal.timeout(settings.requestTimeoutMs),
	});
	if (!response.ok) {
		throw new Error(
			`join endpoint returned ${response.status}: ${await response.text()}`,
		);
	}
	const admission = (await response.json()) as TicketResponse;
	if (admission.roomId !== settings.roomId || admission.role !== "audience") throw new Error("join endpoint did not grant the requested audience room membership");
	if (admission.shardId) client.actualShard = admission.shardId;
	return admission;
}

function socketUrl(admission: TicketResponse): URL {
	const url = new URL(admission.url ?? admission.wsUrl ?? settings.socketUrl);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	return url;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: undefined;
}

function findString(value: unknown, names: string[]): string | undefined {
	const object = objectValue(value);
	if (!object) return undefined;
	for (const name of names) {
		if (typeof object[name] === "string") return object[name];
	}
	for (const name of ["payload", "event", "data", "meta"]) {
		const found = findString(object[name], names);
		if (found) return found;
	}
	return undefined;
}

function findStrings(value: unknown, names: string[]): string[] | undefined {
	const object = objectValue(value);
	if (!object) return undefined;
	for (const name of names) {
		const candidate = object[name];
		if (
			Array.isArray(candidate) &&
			candidate.every((item) => typeof item === "string")
		) {
			return candidate;
		}
	}
	for (const name of ["payload", "event", "data", "meta"]) {
		const found = findStrings(object[name], names);
		if (found) return found;
	}
	return undefined;
}

function activePromptId(value: unknown): string | undefined {
	const message = objectValue(value);
	const state = objectValue(message?.state);
	const activePrompt = objectValue(state?.activePrompt);
	return typeof activePrompt?.id === "string" ? activePrompt.id : undefined;
}

function clearFinishedProbe(client: ClientRecord): void {
	const pending = client.pendingProbe;
	if (!pending || probeLedger.hasPending(pending.id)) return;
	clearTimeout(pending.acceptanceTimeout);
	clearTimeout(pending.visibilityTimeout);
	client.pendingProbe = undefined;
}

function recordMessage(client: ClientRecord, event: MessageEvent): void {
	let value: unknown;
	try {
		value = JSON.parse(String(event.data));
	} catch {
		return;
	}
	const message = objectValue(value);
	if (!message) return;
	if (typeof message.version === "number") client.expectedVersion = message.version;
	client.activePromptId = activePromptId(message) ?? client.activePromptId;
	const shardId = findString(message, ["shardId", "audienceShardId"]);
	if (shardId) client.actualShard = shardId;

	const pending = client.pendingProbe;
	if (!pending) return;
	if (message.type === "error") {
		const rejectedId = findString(message, ["commandId", "causationId"]);
		if (rejectedId === pending.id) {
			probeLedger.recordRejected(pending.id);
			clearFinishedProbe(client);
		}
		return;
	}
	if (message.type !== "event") return;
	if (message.event === "audience.accepted") {
		const acceptedIds =
			findStrings(message, ["commandIds"]) ??
			[findString(message, ["commandId", "causationId"])].filter(
				(value): value is string => value !== undefined,
			);
		if (
			acceptedIds.includes(pending.id) &&
			probeLedger.recordAccepted(pending.id, performance.now())
		) {
			clearTimeout(pending.acceptanceTimeout);
			clearFinishedProbe(client);
		}
		return;
	}
	if (message.event !== "audience.aggregated") return;
	const committedIds = findStrings(message, ["commandIds"]);
	const committedPrompt = findString(message, ["promptId", "roundId"]);
	const committedShard = findString(message, ["shardId", "audienceShardId"]);
	if (
		!committedIds?.includes(pending.id) ||
		!committedPrompt ||
		!committedShard
	) {
		return;
	}
	if (
		probeLedger.recordAggregateVisible(
			[pending.id],
			committedPrompt,
			committedShard,
			performance.now(),
		) > 0
	) {
		clearTimeout(pending.visibilityTimeout);
		clearFinishedProbe(client);
	}
}

function sendProbe(client: ClientRecord): void {
	if (
		client.probeSent ||
		client.socket?.readyState !== WebSocket.OPEN ||
		client.expectedVersion === undefined ||
		!client.actualShard
	) {
		return;
	}
	const promptId = settings.promptId ?? client.activePromptId;
	if (!promptId) return;
	const id = `probe-${settings.processIndex}-${client.globalIndex}-${probeSequence}`;
	probeSequence += 1;
	const sentAt = performance.now();
	probeLedger.register({ id, promptId, shardId: client.actualShard, sentAt });
	const acceptanceTimeout = setTimeout(() => {
		probeLedger.recordAcceptanceTimeout(id);
		clearFinishedProbe(client);
	}, settings.acceptanceTimeoutMs);
	const visibilityTimeout = setTimeout(() => {
		probeLedger.recordVisibilityTimeout(id);
		clearFinishedProbe(client);
	}, settings.visibilityTimeoutMs);
	client.pendingProbe = {
		id,
		promptId,
		acceptanceTimeout,
		visibilityTimeout,
	};
	client.probeSent = true;
	client.socket.send(
		JSON.stringify({
			v: 1,
			id,
			type: "audience.vote",
			expectedVersion: client.expectedVersion,
			sentAt: new Date().toISOString(),
			payload: { ...settings.probePayload, promptId },
		}),
	);
}

async function connect(client: ClientRecord): Promise<void> {
	try {
		const cookie = await createSession(client);
		const admission = await joinRoom(client, cookie);
		const ticket = admission.ticket ?? admission.wsTicket;
		if (!ticket) throw new Error("ticket response did not contain ticket or wsTicket");

		await new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(socketUrl(admission), `arcade-ticket.${ticket}`);
			client.socket = socket;
			let settled = false;
			const fail = (error: Error) => {
				if (settled) return;
				settled = true;
				reject(error);
			};
			const timeout = setTimeout(() => {
				socket.close(4000, "connect timeout");
				fail(new Error("WebSocket connect timeout"));
			}, settings.connectTimeoutMs);
			socket.addEventListener(
				"open",
				() => {
					if (settled) return;
					settled = true;
					clearTimeout(timeout);
					client.openedAt = performance.now();
					resolve();
				},
				{ once: true },
			);
			socket.addEventListener("message", (event) => recordMessage(client, event));
			socket.addEventListener("close", (event) => {
				clearTimeout(timeout);
				client.closedAt = performance.now();
				client.closeCode = event.code;
				fail(new Error(`WebSocket closed during handshake (${event.code})`));
			});
			socket.addEventListener(
				"error",
				() => fail(new Error("WebSocket connection error")),
				{ once: true },
			);
		});
	} catch (error) {
		client.error = error instanceof Error ? error.message : String(error);
	}
}

async function connectAll(): Promise<void> {
	let cursor = 0;
	const workers = Array.from(
		{ length: Math.min(settings.connectConcurrency, clients.length) },
		async () => {
			while (cursor < clients.length && !interrupted) {
				const client = clients[cursor];
				cursor += 1;
				if (client) await connect(client);
			}
		},
	);
	await Promise.all(workers);
}

async function waitForVoteBarrier(): Promise<void> {
	const deadline = performance.now() + settings.requestTimeoutMs;
	while (performance.now() < deadline) {
		const ready = clients.every(
			(client) =>
				client.socket?.readyState === WebSocket.OPEN &&
				client.expectedVersion !== undefined &&
				client.actualShard !== undefined &&
				(settings.promptId !== undefined || client.activePromptId !== undefined),
		);
		if (ready) {
			const promptIds = new Set(
				clients.map((client) => settings.promptId ?? client.activePromptId),
			);
			if (promptIds.size !== 1) {
				throw new Error(
					"audience clients observed different active prompts during the vote barrier",
				);
			}
			return;
		}
		await Bun.sleep(25);
	}
	throw new Error(
		"audience clients did not all receive shard and active-prompt state before the vote barrier",
	);
}

async function dispatchVotes(): Promise<void> {
	if (settings.synchronizedBurst) {
		for (const client of clients) sendProbe(client);
		return;
	}
	await Promise.all(
		clients.map(async (client) => {
			await Bun.sleep(Math.floor(Math.random() * settings.probeEveryMs));
			sendProbe(client);
		}),
	);
}

function summarize(): Summary {
	const finishedAt = new Date();
	const opened = clients.filter((client) => client.openedAt !== undefined).length;
	const openAtEnd = clients.filter(
		(client) => client.socket?.readyState === WebSocket.OPEN,
	).length;
	const failed = clients.filter((client) => client.error).length;
	const unexpectedlyClosed = clients.filter(
		(client) => client.openedAt !== undefined && client.closedAt !== undefined,
	).length;
	const probes = probeLedger.summary();
	const observedShardConnections: Record<string, number> = {};
	for (const client of clients) {
		if (!client.actualShard || client.openedAt === undefined) continue;
		observedShardConnections[client.actualShard] =
			(observedShardConnections[client.actualShard] ?? 0) + 1;
	}
	const actualDurationMs =
		measurementStartedAt === undefined
			? 0
			: (measurementFinishedAt ?? performance.now()) - measurementStartedAt;
	const fullDurationCompleted =
		measurementCompleted && actualDurationMs >= settings.durationMs;
	const allConnectionsOpened =
		opened === clients.length &&
		openAtEnd === clients.length &&
		failed === 0 &&
		unexpectedlyClosed === 0;
	const expectedShardIds = new Set(
		Array.from({ length: settings.shards }, (_, index) => String(index)),
	);
	const observedShardIds = Object.keys(observedShardConnections);
	const allShardsObserved =
		observedShardIds.length === expectedShardIds.size &&
		observedShardIds.every((shardId) => expectedShardIds.has(shardId));
	const acceptanceP95WithinBudget =
		probes.acceptance.p95Ms !== null &&
		probes.acceptance.p95Ms <= settings.acceptanceP95BudgetMs;
	const aggregateVisibilityP95WithinBudget =
		probes.aggregateCommitVisibility.p95Ms !== null &&
		probes.aggregateCommitVisibility.p95Ms <= settings.visibilityP95BudgetMs;
	const acceptanceCoverageAtLeast95Percent = probes.acceptance.coverage >= 0.95;
	const aggregateVisibilityCoverageAtLeast95Percent =
		probes.aggregateCommitVisibility.coverage >= 0.95;
	const allPlannedVotesSent = probes.sent === clients.length;
	const acceptanceTimeoutRateAtMost1Percent =
		probes.acceptance.timeoutRate <= 0.01;
	const aggregateVisibilityTimeoutRateAtMost1Percent =
		probes.aggregateCommitVisibility.timeoutRate <= 0.01;
	const noRejectedProbes = probes.rejected === 0;

	return {
		type: "rawkode-arcade-load-summary",
		startedAt: runStartedAt.toISOString(),
		finishedAt: finishedAt.toISOString(),
		measurement: {
			startedAt: wallClock(measurementStartedAt),
			finishedAt: wallClock(measurementFinishedAt),
			requiredDurationMs: settings.durationMs,
			actualDurationMs: Math.round(actualDurationMs),
			completed: measurementCompleted,
		},
		process: { index: settings.processIndex, count: settings.processCount },
		target: {
			globalClients: settings.clients,
			localClients: clients.length,
			shards: settings.shards,
		},
		connections: { opened, openAtEnd, failed, unexpectedlyClosed },
		probes: {
			...probes,
			semantics: {
				acceptance:
					"audience.accepted after authoritative admission and local durable commit",
				aggregateCommitVisibility:
					"correlated audience.aggregated delivered to the originating socket after aggregate commit",
				publicSnapshotFanout: "not-correlatable",
			},
		},
		observedShardConnections,
		gates: {
			fullDurationCompleted,
			allConnectionsOpened,
			allShardsObserved,
			acceptanceP95WithinBudget,
			aggregateVisibilityP95WithinBudget,
			acceptanceCoverageAtLeast95Percent,
			aggregateVisibilityCoverageAtLeast95Percent,
			allPlannedVotesSent,
			acceptanceTimeoutRateAtMost1Percent,
			aggregateVisibilityTimeoutRateAtMost1Percent,
			noRejectedProbes,
			passed:
				fullDurationCompleted &&
				allConnectionsOpened &&
				allShardsObserved &&
				acceptanceP95WithinBudget &&
				aggregateVisibilityP95WithinBudget &&
				acceptanceCoverageAtLeast95Percent &&
				aggregateVisibilityCoverageAtLeast95Percent &&
				allPlannedVotesSent &&
				acceptanceTimeoutRateAtMost1Percent &&
				aggregateVisibilityTimeoutRateAtMost1Percent &&
				noRejectedProbes,
		},
	};
}

function closeAll(reason: string): void {
	for (const client of clients) {
		if (client.pendingProbe) {
			clearTimeout(client.pendingProbe.acceptanceTimeout);
			clearTimeout(client.pendingProbe.visibilityTimeout);
		}
		if (client.socket?.readyState === WebSocket.OPEN) {
			client.socket.close(1000, reason);
		}
	}
}

function printSummary(): Summary {
	const summary = summarize();
	process.stdout.write(`${JSON.stringify(summary)}\n`);
	return summary;
}

async function main(): Promise<void> {
	process.stdout.write(
		`${JSON.stringify({
			type: "rawkode-arcade-load-start",
			globalClients: settings.clients,
			localClients: clients.length,
			shards: settings.shards,
			durationMs: settings.durationMs,
			probeType: "audience.vote",
			votePattern: settings.synchronizedBurst ? "synchronized-burst" : "jittered",
			acceptanceP95BudgetMs: settings.acceptanceP95BudgetMs,
			visibilityP95BudgetMs: settings.visibilityP95BudgetMs,
			processIndex: settings.processIndex,
			processCount: settings.processCount,
		})}\n`,
	);

	await connectAll();
	if (interrupted) return;
	if (clients.some((client) => client.openedAt === undefined)) {
		printSummary();
		closeAll("connection gate failed");
		process.exitCode = 1;
		return;
	}
	try {
		await waitForVoteBarrier();
	} catch (error) {
		for (const client of clients) {
			if (!client.error) {
				client.error = error instanceof Error ? error.message : String(error);
			}
		}
		printSummary();
		closeAll("vote barrier failed");
		process.exitCode = 1;
		return;
	}

	measurementStartedAt = performance.now();
	const holdDuration = Bun.sleep(settings.durationMs);
	await dispatchVotes();
	await holdDuration;
	measurementFinishedAt = performance.now();
	measurementCompleted = true;
	const summary = printSummary();
	closeAll("rehearsal complete");
	if (!summary.gates.passed) process.exitCode = 1;
}

process.once("SIGINT", () => {
	interrupted = true;
	measurementFinishedAt = performance.now();
	measurementCompleted = false;
	printSummary();
	closeAll("rehearsal interrupted");
	process.exit(130);
});

await main();
