// Collects the keys a field asks for while one request resolves a list (an
// allX query, or a gateway _entities batch) and loads them with one call,
// instead of one query per parent. Results are cached for the request.
//
// The schema is built once per isolate, so loads are grouped by the
// request's GraphQL context rather than held in getSchema's closure.
export const batchLoader = <K, V>(
	loadMany: (keys: K[]) => Promise<Map<K, V>>,
	missing: () => V,
) => {
	type Pending = { resolve: (value: V) => void; reject: (error: unknown) => void };
	type State = { cache: Map<K, Promise<V>>; queue?: Map<K, Pending> };
	const requests = new WeakMap<object, State>();

	const dispatch = (queue: Map<K, Pending>) =>
		loadMany([...queue.keys()]).then(
			(values) => {
				for (const [key, pending] of queue) pending.resolve(values.get(key) ?? missing());
			},
			(error) => {
				for (const pending of queue.values()) pending.reject(error);
			},
		);

	return (context: object, key: K): Promise<V> => {
		let state = requests.get(context);
		if (!state) {
			state = { cache: new Map() };
			requests.set(context, state);
		}
		const cached = state.cache.get(key);
		if (cached) return cached;

		const current = state;
		const queue = current.queue ?? new Map<K, Pending>();
		if (!current.queue) {
			current.queue = queue;
			// A macrotask, so every sibling resolver queued by the pending
			// microtasks joins this batch before it is sent.
			setTimeout(() => {
				current.queue = undefined;
				void dispatch(queue);
			}, 0);
		}
		const promise = new Promise<V>((resolve, reject) => {
			queue.set(key, { resolve, reject });
		});
		state.cache.set(key, promise);
		return promise;
	};
};

// D1 caps bound parameters per statement, so id lists are queried in chunks.
export const chunk = <T>(items: T[], size = 90) =>
	Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
		items.slice(i * size, i * size + size),
	);

// Groups rows into lists per key, keeping the rows' order.
export const groupBy = <K, T>(rows: T[], key: (row: T) => K) => {
	const groups = new Map<K, T[]>();
	for (const row of rows) {
		const k = key(row);
		const group = groups.get(k);
		if (group) group.push(row);
		else groups.set(k, [row]);
	}
	return groups;
};
