// Each destination owns its acknowledgement. External I/O never runs in a
// storage transaction; deleting only the selected keys preserves concurrent adds.
const DESTINATIONS = ["basin", "posthog", "grafana"] as const;
export type Destination = (typeof DESTINATIONS)[number];
const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 12;
const FLUSH_DELAY_MS = 30_000;

type Entry<T> = { payload: T; attempts: number; acceptedAt: number };
type DeliveryStats = {
	accepted: number;
	delivered: number;
	retried: number;
	pending: number;
	failed: number;
	lastDeliveredAt?: number;
};
const emptyStats = (): DeliveryStats => ({
	accepted: 0,
	delivered: 0,
	retried: 0,
	pending: 0,
	failed: 0,
});
const prefix = (destination: Destination) => `delivery/pending/${destination}/`;
const dueAt = (key: string) => Number(key.split("/")[3]);
const pendingKey = (destination: Destination, due: number) =>
	`${prefix(destination)}${String(due).padStart(16, "0")}/${crypto.randomUUID()}`;
const statsKey = (destination: Destination) => `delivery/stats/${destination}`;

type Storage = Pick<DurableObjectStorage, "transaction" | "list" | "get">;

export class DeliveryQueue<T> {
	constructor(private readonly storage: Storage) {}

	private async write(
		txn: DurableObjectTransaction,
		payload: T,
		destinations: readonly Destination[],
	) {
		const now = Date.now();
		for (const destination of destinations) {
			const stats =
				(await txn.get<DeliveryStats>(statsKey(destination))) ?? emptyStats();
			await txn.put(pendingKey(destination, now), {
				payload,
				attempts: 0,
				acceptedAt: now,
			} satisfies Entry<T>);
			await txn.put(statsKey(destination), {
				...stats,
				accepted: stats.accepted + 1,
				pending: stats.pending + 1,
			});
		}
		const alarm = await txn.getAlarm();
		if (alarm === null || alarm > now + FLUSH_DELAY_MS)
			await txn.setAlarm(now + FLUSH_DELAY_MS);
	}

	async enqueue(payload: T, destinations: readonly Destination[]) {
		await this.storage.transaction((txn) =>
			this.write(txn, payload, destinations),
		);
	}

	// Existing array buffers are adopted once, atomically with removing the old key.
	async migrate<Legacy>(
		key: string,
		convert: (value: Legacy) => {
			payload: T;
			destinations: readonly Destination[];
		},
	) {
		await this.storage.transaction(async (txn) => {
			const values = await txn.get<Legacy[]>(key);
			if (!values) return;
			for (const value of values) {
				const { payload, destinations } = convert(value);
				await this.write(txn, payload, destinations);
			}
			await txn.delete(key);
		});
	}

	async drain(
		deliver: (destination: Destination, payloads: T[]) => Promise<void>,
	) {
		// A watchdog survives runtime interruption during external I/O.
		await this.storage.transaction((txn) =>
			txn.setAlarm(Date.now() + FLUSH_DELAY_MS),
		);
		for (const destination of DESTINATIONS) {
			let entries = [
				...(await this.storage.list<Entry<T>>({
					prefix: prefix(destination),
					limit: BATCH_SIZE,
				})),
			].filter(([key]) => dueAt(key) <= Date.now());
			if (!entries.length) continue;
			// Split retries so one malformed payload cannot quarantine an entire batch.
			if (entries.some(([, entry]) => entry.attempts > 0))
				entries = entries.slice(0, 1);
			let delivered = false;
			try {
				let timeout: ReturnType<typeof setTimeout> | undefined;
				try {
					await Promise.race([
						deliver(
							destination,
							entries.map(([, entry]) => entry.payload),
						),
						new Promise<never>((_, reject) => {
							timeout = setTimeout(
								() => reject(new Error("Delivery timed out")),
								20_000,
							);
						}),
					]);
				} finally {
					if (timeout !== undefined) clearTimeout(timeout);
				}
				delivered = true;
			} catch {
				// Log counts only: payloads and destination responses can contain secrets.
				console.error("analytics.delivery.retry", {
					destination,
					records: entries.length,
				});
			}
			await this.storage.transaction(async (txn) => {
				const stats =
					(await txn.get<DeliveryStats>(statsKey(destination))) ?? emptyStats();
				for (const [key, entry] of entries) {
					await txn.delete(key);
					if (delivered) {
						stats.delivered++;
						stats.pending--;
						stats.lastDeliveredAt = Date.now();
						continue;
					}
					const attempts = entry.attempts + 1;
					if (attempts >= MAX_ATTEMPTS) {
						await txn.put(key.replace("/pending/", "/failed/"), {
							...entry,
							attempts,
						});
						stats.pending--;
						stats.failed++;
						console.error("analytics.delivery.failed", {
							destination,
							acceptedAt: entry.acceptedAt,
							attempts,
						});
					} else {
						const delay = Math.min(3_600_000, 30_000 * 2 ** (attempts - 1));
						await txn.put(pendingKey(destination, Date.now() + delay), {
							...entry,
							attempts,
						});
						stats.retried++;
					}
				}
				await txn.put(statsKey(destination), stats);
			});
		}
		await this.schedule();
	}

	private async schedule() {
		await this.storage.transaction(async (txn) => {
			let earliest = Infinity;
			for (const destination of DESTINATIONS) {
				const [key] = (
					await txn.list({ prefix: prefix(destination), limit: 1 })
				).keys();
				if (key) earliest = Math.min(earliest, dueAt(key));
			}
			if (Number.isFinite(earliest))
				await txn.setAlarm(Math.max(Date.now() + 1_000, earliest));
			else await txn.deleteAlarm();
		});
	}

	async status() {
		return Object.fromEntries(
			await Promise.all(
				DESTINATIONS.map(async (destination) => {
					const stats =
						(await this.storage.get<DeliveryStats>(statsKey(destination))) ??
						emptyStats();
					const [next] = await this.storage.list<Entry<T>>({
						prefix: prefix(destination),
						limit: 1,
					});
					return [
						destination,
						{
							...stats,
							nextAttemptAt: next ? dueAt(next[0]) : null,
							nextRecordAcceptedAt: next?.[1].acceptedAt ?? null,
						},
					];
				}),
			),
		) as Record<
			Destination,
			DeliveryStats & {
				nextAttemptAt: number | null;
				nextRecordAcceptedAt: number | null;
			}
		>;
	}

	async replay(destination: Destination) {
		await this.storage.transaction(async (txn) => {
			const entries = await txn.list<Entry<T>>({
				prefix: `delivery/failed/${destination}/`,
				limit: BATCH_SIZE,
			});
			const stats =
				(await txn.get<DeliveryStats>(statsKey(destination))) ?? emptyStats();
			for (const [key, entry] of entries) {
				await txn.put(pendingKey(destination, Date.now()), {
					...entry,
					attempts: 0,
				});
				await txn.delete(key);
				stats.failed--;
				stats.pending++;
			}
			await txn.put(statsKey(destination), stats);
			if (entries.size) await txn.setAlarm(Date.now() + 1_000);
		});
	}
}

// Fixed shards avoid turning the collector into one global coordination object.
// Keep the shard count stable so older queues remain discoverable for replay.
const EVENT_BUFFER_NAMES = Array.from(
	{ length: 16 },
	(_, index) => `buffer-events-${index}`,
);
export function eventBufferName(source: string, id: string) {
	let hash = 2166136261;
	for (const character of `${source}:${id}`)
		hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
	return EVENT_BUFFER_NAMES[(hash >>> 0) % EVENT_BUFFER_NAMES.length]!;
}
export const DELIVERY_BUFFER_NAMES = [
	"buffer-events",
	"buffer-metrics",
	"buffer-exceptions",
	"buffer-logs",
	"buffer-tail",
	...EVENT_BUFFER_NAMES,
];

/** Unambiguous encoding of the CloudEvent uniqueness pair. */
export function cloudEventInsertId(source: string, id: string): string {
	return JSON.stringify([source, id]);
}
