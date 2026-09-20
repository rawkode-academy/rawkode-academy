/**
 * Production WebSocket audience rehearsal for Rawkode Arcade.
 *
 * The runner creates one signed anonymous session, joins it through an audience
 * invite, and consumes one single-use room ticket per socket. It fails closed if the server does not confirm actual
 * shard placement, if commands are rejected, if a connection drops, or if the
 * full steady-state duration is not completed.
 */

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
	probeTimeoutMs: number;
	p95BudgetMs: number;
	processCount: number;
	processIndex: number;
	probeType: string;
	expectedEvent: string;
	probePayload: Record<string, unknown>;
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
	pendingProbe?: {
		id: string;
		promptId: string;
		sentAt: number;
		timeout: ReturnType<typeof setTimeout>;
	};
	probeTimer?: ReturnType<typeof setInterval>;
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
	probes: {
		sent: number;
		acknowledged: number;
		rejected: number;
		timedOut: number;
		lost: number;
		p50Ms: number | null;
		p95Ms: number | null;
		p99Ms: number | null;
		maxMs: number | null;
		latencyHistogramMs: Record<string, number>;
	};
	observedShardConnections: Record<string, number>;
	gates: {
		fullDurationCompleted: boolean;
		allConnectionsOpened: boolean;
		allShardsObserved: boolean;
		p95WithinBudget: boolean;
		probeCoverageAtLeast95Percent: boolean;
		offeredLoadSustained: boolean;
		probeTimeoutRateAtMost1Percent: boolean;
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

	let probePayload: Record<string, unknown> = { reaction: "ship" };
	if (process.env.ARCADE_LOAD_PROBE_PAYLOAD_JSON) {
		const parsed = JSON.parse(process.env.ARCADE_LOAD_PROBE_PAYLOAD_JSON);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("ARCADE_LOAD_PROBE_PAYLOAD_JSON must be a JSON object");
		}
		probePayload = parsed;
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
		clients: integer("ARCADE_LOAD_CLIENTS", 10_000, 1),
		shards: integer("ARCADE_LOAD_SHARDS", 32, 1),
		durationMs: integer("ARCADE_LOAD_DURATION_SECONDS", 1_800, 1) * 1_000,
		connectConcurrency: integer("ARCADE_LOAD_CONNECT_CONCURRENCY", 200, 1),
		requestTimeoutMs: integer("ARCADE_LOAD_REQUEST_TIMEOUT_MS", 15_000, 1),
		connectTimeoutMs: integer("ARCADE_LOAD_CONNECT_TIMEOUT_MS", 15_000, 1),
		probeEveryMs: integer("ARCADE_LOAD_PROBE_EVERY_MS", 5_000, 250),
		probeTimeoutMs: integer("ARCADE_LOAD_PROBE_TIMEOUT_MS", 2_000, 100),
		p95BudgetMs: integer("ARCADE_LOAD_P95_BUDGET_MS", 250, 1),
		processCount,
		processIndex,
		probeType: process.env.ARCADE_LOAD_PROBE_TYPE ?? "audience.reaction",
		expectedEvent:
			process.env.ARCADE_LOAD_EXPECTED_EVENT ?? "audience.aggregated",
		probePayload,
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

const latencies: number[] = [];
let probesSent = 0;
let probesRejected = 0;
let probesTimedOut = 0;

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
	const shardId = findString(message, ["shardId", "audienceShardId"]);
	if (shardId) client.actualShard = shardId;

	const pending = client.pendingProbe;
	if (!pending) return;
	if (message.type === "error") {
		const rejectedId = findString(message, ["commandId", "causationId"]);
		if (rejectedId === pending.id) {
			clearTimeout(pending.timeout);
			client.pendingProbe = undefined;
			probesRejected += 1;
		}
		return;
	}
	if (message.type !== "event" || message.event !== settings.expectedEvent) return;
	const committedIds = findStrings(message, ["commandIds"]);
	const committedPrompt = findString(message, ["promptId", "roundId"]);
	const committedShard = findString(message, ["shardId", "audienceShardId"]);
	if (
		!committedIds?.includes(pending.id) ||
		committedPrompt !== pending.promptId ||
		committedShard !== client.actualShard
	) {
		return;
	}

	// There is one command in flight per connection. Only the correlated event
	// emitted after authoritative aggregation can complete it; receipt acks,
	// snapshots, pongs, and errors never count as latency.
	clearTimeout(pending.timeout);
	client.pendingProbe = undefined;
	latencies.push(performance.now() - pending.sentAt);
}

function startProbes(client: ClientRecord): void {
	const send = () => {
		if (
			client.socket?.readyState !== WebSocket.OPEN ||
			client.pendingProbe ||
			client.expectedVersion === undefined
		) {
			return;
		}
		const id = `probe-${settings.processIndex}-${client.globalIndex}-${probesSent}`;
		const promptId = `load-${Math.floor(
			(performance.now() - (measurementStartedAt ?? performance.now())) /
				settings.probeEveryMs,
		)}`;
		const sentAt = performance.now();
		const timeout = setTimeout(() => {
			if (client.pendingProbe?.id !== id) return;
			client.pendingProbe = undefined;
			probesTimedOut += 1;
		}, settings.probeTimeoutMs);
		client.pendingProbe = { id, promptId, sentAt, timeout };
		probesSent += 1;
		client.socket.send(
			JSON.stringify({
				v: 1,
				id,
				type: settings.probeType,
				expectedVersion: client.expectedVersion,
				sentAt: new Date().toISOString(),
				payload: { ...settings.probePayload, promptId },
			}),
		);
	};
	client.probeTimer = setInterval(send, settings.probeEveryMs);
	setTimeout(send, Math.floor(Math.random() * settings.probeEveryMs));
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
				if (client.probeTimer) clearInterval(client.probeTimer);
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

function percentile(sorted: number[], fraction: number): number | null {
	if (sorted.length === 0) return null;
	return sorted[Math.ceil(sorted.length * fraction) - 1] ?? null;
}

function rounded(value: number | null): number | null {
	return value === null ? null : Math.round(value * 100) / 100;
}

function histogram(values: number[]): Record<string, number> {
	const result: Record<string, number> = {};
	for (const value of values) {
		const bucket = String(Math.max(0, Math.ceil(value)));
		result[bucket] = (result[bucket] ?? 0) + 1;
	}
	return result;
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
	const sorted = [...latencies].sort((left, right) => left - right);
	const p95Ms = percentile(sorted, 0.95);
	const acknowledged = latencies.length;
	const probeCoverage = probesSent === 0 ? 0 : acknowledged / probesSent;
	const probeTimeoutRate =
		probesSent === 0 ? 1 : probesTimedOut / probesSent;
	const expectedProbesPerClient = Math.max(
		1,
		Math.floor(settings.durationMs / settings.probeEveryMs) - 1,
	);
	const minimumExpectedProbes = expectedProbesPerClient * clients.length;
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
	const p95WithinBudget = p95Ms !== null && p95Ms <= settings.p95BudgetMs;
	const probeCoverageAtLeast95Percent = probeCoverage >= 0.95;
	const offeredLoadSustained = probesSent >= minimumExpectedProbes;
	const probeTimeoutRateAtMost1Percent = probeTimeoutRate <= 0.01;
	const noRejectedProbes = probesRejected === 0;

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
			sent: probesSent,
			acknowledged,
			rejected: probesRejected,
			timedOut: probesTimedOut,
			lost: Math.max(
				0,
				probesSent - acknowledged - probesRejected - probesTimedOut,
			),
			p50Ms: rounded(percentile(sorted, 0.5)),
			p95Ms: rounded(p95Ms),
			p99Ms: rounded(percentile(sorted, 0.99)),
			maxMs: rounded(sorted.at(-1) ?? null),
			latencyHistogramMs: histogram(latencies),
		},
		observedShardConnections,
		gates: {
			fullDurationCompleted,
			allConnectionsOpened,
			allShardsObserved,
			p95WithinBudget,
			probeCoverageAtLeast95Percent,
			offeredLoadSustained,
			probeTimeoutRateAtMost1Percent,
			noRejectedProbes,
			passed:
				fullDurationCompleted &&
				allConnectionsOpened &&
				allShardsObserved &&
				p95WithinBudget &&
				probeCoverageAtLeast95Percent &&
				offeredLoadSustained &&
				probeTimeoutRateAtMost1Percent &&
				noRejectedProbes,
		},
	};
}

function closeAll(reason: string): void {
	for (const client of clients) {
		if (client.probeTimer) clearInterval(client.probeTimer);
		if (client.pendingProbe) clearTimeout(client.pendingProbe.timeout);
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

	measurementStartedAt = performance.now();
	for (const client of clients) startProbes(client);
	await Bun.sleep(settings.durationMs);
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
