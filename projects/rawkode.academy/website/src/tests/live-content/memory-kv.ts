import type { ContentKV } from "@/lib/live-content/env";

/** In-memory KV with call counters, for content-layer tests. */
export function memoryKv(initial: Record<string, string> = {}) {
	const store = new Map<string, string>(Object.entries(initial));
	const calls = { get: 0, put: 0 };
	const kv: ContentKV & { store: Map<string, string>; calls: typeof calls } = {
		store,
		calls,
		async get(key: string, options: { type: "text" | "json" }) {
			calls.get++;
			const value = store.get(key);
			if (value === undefined) return null;
			return options.type === "json" ? JSON.parse(value) : value;
		},
		async put(key: string, value: string) {
			calls.put++;
			store.set(key, value);
		},
		async delete(key: string) {
			store.delete(key);
		},
	} as never;
	return kv;
}
