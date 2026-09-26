export interface ProjectedEntry {
	principalId: string;
	teamId: string | null;
	score: number;
	rank: number;
}

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
	signal.throwIfAborted();
	return new Promise((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timer);
			reject(signal.reason);
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, delay);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

/** Completion is authoritative before its D1 result projection is available. */
export async function loadRoomLeaderboard(
	roomId: string,
	signal: AbortSignal,
	options: {
		fetcher?: (url: string, options: RequestInit) => Promise<Response>;
		wait?: (delay: number, signal: AbortSignal) => Promise<void>;
		random?: () => number;
	} = {},
): Promise<ProjectedEntry[]> {
	const fetcher = options.fetcher ?? fetch;
	const wait = options.wait ?? waitForRetry;
	const random = options.random ?? Math.random;
	for (let attempt = 0; attempt < 6; attempt += 1) {
		signal.throwIfAborted();
		let response: Response | undefined;
		try {
			response = await fetcher(`/api/rooms/${encodeURIComponent(roomId)}/leaderboard`, {
				credentials: "same-origin",
				signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
			});
		} catch {
			signal.throwIfAborted();
		}
		if (response?.ok) {
			const value = await response.json() as { entries?: ProjectedEntry[] };
			if (Array.isArray(value.entries) && value.entries.length > 0) return value.entries;
		} else if (response && response.status >= 400 && response.status < 500 && response.status !== 429) {
			throw new Error("Unable to load this room's final results. Check the room link and try again.");
		}
		if (attempt < 5) {
			// Jitter keeps many viewers from retrying in lockstep after completion.
			await wait(500 * 2 ** attempt * (0.8 + random() * 0.4), signal);
		}
	}
	throw new Error("Final results are still being prepared. Try again shortly.");
}
