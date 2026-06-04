import type { LiveEvent } from "./types";

const EVENT_PREFIX = "live-event:";
const CURRENT_EVENT_KEY = "live-event:current";

export interface LiveEventStore {
	get(id: string): Promise<LiveEvent | null>;
	put(event: LiveEvent): Promise<void>;
	list(): Promise<LiveEvent[]>;
	getCurrent(): Promise<LiveEvent | null>;
	setCurrent(id: string): Promise<void>;
}

export class KvLiveEventStore implements LiveEventStore {
	constructor(private readonly kv: KVNamespace) {}

	async get(id: string): Promise<LiveEvent | null> {
		return await this.kv.get<LiveEvent>(`${EVENT_PREFIX}${id}`, "json");
	}

	async put(event: LiveEvent): Promise<void> {
		await this.kv.put(`${EVENT_PREFIX}${event.id}`, JSON.stringify(event));
		await this.setCurrent(event.id);
	}

	async list(): Promise<LiveEvent[]> {
		const result = await this.kv.list({ prefix: EVENT_PREFIX });
		const events = await Promise.all(result.keys.map((key) => this.kv.get<LiveEvent>(key.name, "json")));
		return events
			.filter((event): event is LiveEvent => event !== null)
			.sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
	}

	async getCurrent(): Promise<LiveEvent | null> {
		const id = await this.kv.get(CURRENT_EVENT_KEY);
		return id ? await this.get(id) : null;
	}

	async setCurrent(id: string): Promise<void> {
		await this.kv.put(CURRENT_EVENT_KEY, id);
	}
}

export class MemoryLiveEventStore implements LiveEventStore {
	private readonly events = new Map<string, LiveEvent>();
	private currentId: string | null = null;

	async get(id: string): Promise<LiveEvent | null> {
		return this.events.get(id) ?? null;
	}

	async put(event: LiveEvent): Promise<void> {
		this.events.set(event.id, structuredClone(event));
		this.currentId = event.id;
	}

	async list(): Promise<LiveEvent[]> {
		return [...this.events.values()].sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
	}

	async getCurrent(): Promise<LiveEvent | null> {
		return this.currentId ? await this.get(this.currentId) : null;
	}

	async setCurrent(id: string): Promise<void> {
		if (!this.events.has(id)) {
			throw new Error(`Live event ${id} does not exist`);
		}
		this.currentId = id;
	}
}
