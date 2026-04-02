export type TimeoutOptions = {
	timeoutMs?: number;
	label?: string;
};

export type FetchLike = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

function createTimeoutError(
	label: string,
	timeoutMs: number,
): Error {
	return new Error(`${label} timed out after ${timeoutMs}ms`);
}

export async function withTimeout<T>(
	run: () => Promise<T>,
	options: TimeoutOptions = {},
): Promise<T> {
	const { timeoutMs = 5000, label = "Operation" } = options;
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	try {
		const timeoutPromise = new Promise<never>((_, reject) => {
			timeoutId = setTimeout(() => {
				reject(createTimeoutError(label, timeoutMs));
			}, timeoutMs);
		});

		return await Promise.race([run(), timeoutPromise]);
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
}

export async function fetchWithTimeout(
	fetchImpl: FetchLike,
	input: RequestInfo | URL,
	init: RequestInit = {},
	options: TimeoutOptions = {},
): Promise<Response> {
	const { timeoutMs = 5000, label = "Request" } = options;
	const abortController = new AbortController();
	const timeoutId = setTimeout(() => {
		abortController.abort();
	}, timeoutMs);

	try {
		return await fetchImpl(input, {
			...init,
			signal: abortController.signal,
		});
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw createTimeoutError(label, timeoutMs);
		}

		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}
