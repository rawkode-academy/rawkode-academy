import {
	afterEach,
	beforeEach,
	describe,
	expect,
	setSystemTime,
	test,
} from "bun:test";
import {
	DeliveryQueue,
	eventBufferName,
	cloudEventInsertId,
} from "../src/delivery-queue";

class Storage {
	values = new Map<string, unknown>();
	alarm: number | null = null;
	async get<T>(key: string): Promise<T | undefined> {
		return structuredClone(this.values.get(key)) as T | undefined;
	}
	async put(key: string, value: unknown) {
		this.values.set(key, structuredClone(value));
	}
	async delete(key: string) {
		return this.values.delete(key);
	}
	async getAlarm() {
		return this.alarm;
	}
	async setAlarm(time: number) {
		this.alarm = time;
	}
	async deleteAlarm() {
		this.alarm = null;
	}
	async list<T>({
		prefix = "",
		limit = Infinity,
	} = {}): Promise<Map<string, T>> {
		return new Map(
			[...this.values]
				.filter(([key]) => key.startsWith(prefix))
				.sort(([a], [b]) => a.localeCompare(b))
				.slice(0, limit)
				.map(([key, value]) => [key, structuredClone(value) as T]),
		);
	}
	async transaction<T>(callback: (txn: Storage) => Promise<T>): Promise<T> {
		const before = structuredClone(this.values),
			alarm = this.alarm;
		try {
			return await callback(this);
		} catch (error) {
			this.values = before;
			this.alarm = alarm;
			throw error;
		}
	}
	queue() {
		return new DeliveryQueue<{ id: string }>(
			this as unknown as DurableObjectStorage,
		);
	}
}
let storage: Storage;
const now = 1_800_000_000_000;
beforeEach(() => {
	storage = new Storage();
	setSystemTime(now);
});
afterEach(() => {
	setSystemTime();
});

describe("durable destination delivery", () => {
	test("acceptance persists every destination and alarm", async () => {
		await storage.queue().enqueue({ id: "one" }, ["basin", "posthog"]);
		expect((await storage.list({ prefix: "delivery/pending/" })).size).toBe(2);
		expect(storage.alarm).toBe(now + 30_000);
	});
	test("failed Basin survives restart without replaying acknowledged PostHog", async () => {
		await storage.queue().enqueue({ id: "one" }, ["basin", "posthog"]);
		await storage.queue().drain(async (destination) => {
			if (destination === "basin") throw new Error("outage");
		});
		expect((await storage.queue().status()).basin).toMatchObject({
			pending: 1,
			delivered: 0,
			retried: 1,
		});
		expect((await storage.queue().status()).posthog).toMatchObject({
			pending: 0,
			delivered: 1,
		});
		setSystemTime(now + 31_000);
		await storage.queue().drain(async (destination, records) => {
			expect(destination).toBe("basin");
			expect(records).toEqual([{ id: "one" }]);
		});
		expect((await storage.queue().status()).basin.pending).toBe(0);
		expect(storage.alarm).toBeNull();
	});
	test("concurrent arrival during external I/O is not deleted", async () => {
		await storage.queue().enqueue({ id: "one" }, ["basin"]);
		await storage.queue().drain(async () => {
			await storage.queue().enqueue({ id: "two" }, ["basin"]);
		});
		expect((await storage.queue().status()).basin).toMatchObject({
			pending: 1,
			delivered: 1,
		});
		await storage.queue().drain(async (_, records) => {
			expect(records).toEqual([{ id: "two" }]);
		});
	});
	test("poison records are retained after bounded retries and can be replayed", async () => {
		await storage.queue().enqueue({ id: "poison" }, ["basin"]);
		for (let i = 0; i < 12; i++) {
			await storage.queue().drain(async () => {
				throw new Error("outage");
			});
			setSystemTime(now + (i + 1) * 4_000_000);
		}
		expect((await storage.queue().status()).basin).toMatchObject({
			failed: 1,
			pending: 0,
		});
		expect(
			(await storage.list({ prefix: "delivery/failed/basin/" })).size,
		).toBe(1);
		await storage.queue().replay("basin");
		expect(storage.alarm).not.toBeNull();
		await storage.queue().drain(async (_, records) => {
			expect(records[0]?.id).toBe("poison");
		});
		expect((await storage.queue().status()).basin).toMatchObject({
			failed: 0,
			delivered: 1,
		});
	});
	test("one poison record cannot quarantine its healthy peers", async () => {
		for (const id of ["healthy", "poison"])
			await storage.queue().enqueue({ id }, ["basin"]);
		const deliver = async (_: string, records: { id: string }[]) => {
			if (records.some((r) => r.id === "poison")) throw new Error("poison");
		};
		await storage.queue().drain(deliver);
		for (let i = 0; i < 14; i++) {
			setSystemTime(now + (i + 1) * 4_000_000);
			await storage.queue().drain(deliver);
		}
		expect((await storage.queue().status()).basin).toMatchObject({
			delivered: 1,
			failed: 1,
		});
	});
	test("legacy buffers migrate once", async () => {
		await storage.put("events", [{ id: "old" }]);
		const migrate = () =>
			storage.queue().migrate<{ id: string }>("events", (value) => ({
				payload: value,
				destinations: ["basin"],
			}));
		await migrate();
		await migrate();
		expect(await storage.get("events")).toBeUndefined();
		expect((await storage.queue().status()).basin.accepted).toBe(1);
	});
	test("failed acceptance rolls back records and scheduling", async () => {
		storage.setAlarm = async () => {
			throw new Error("storage unavailable");
		};
		await expect(
			storage.queue().enqueue({ id: "one" }, ["basin"]),
		).rejects.toThrow("storage unavailable");
		expect(storage.values.size).toBe(0);
	});
	test("PostHog outage cannot block Basin or Grafana", async () => {
		await storage
			.queue()
			.enqueue({ id: "one" }, ["basin", "posthog", "grafana"]);
		await storage.queue().drain(async (destination) => {
			if (destination === "posthog") throw new Error("outage");
		});
		const status = await storage.queue().status();
		expect(status.basin.delivered).toBe(1);
		expect(status.grafana.delivered).toBe(1);
		expect(status.posthog.pending).toBe(1);
	});
	test("source and id select the same bounded shard", () => {
		expect(eventBufferName("website", "id")).toBe(
			eventBufferName("website", "id"),
		);
		expect(
			new Set(
				Array.from({ length: 100 }, (_, i) =>
					eventBufferName("website", String(i)),
				),
			).size,
		).toBe(16);
	});
});

test("PostHog insert IDs preserve source/id boundaries", () => {
	expect(cloudEventInsertId("a:b", "c")).not.toBe(
		cloudEventInsertId("a", "b:c"),
	);
	expect(cloudEventInsertId("website", "event-1")).toBe(
		cloudEventInsertId("website", "event-1"),
	);
});
