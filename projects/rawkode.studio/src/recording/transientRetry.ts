const transientStatuses = new Set([408, 425, 429]);

export interface TransientFetchRetryOptions {
	baseDelayMs?: number;
	fetcher?: typeof fetch;
	maxAttempts?: number;
	maxDelayMs?: number;
	sleep?: (delayMs: number) => Promise<void>;
}

export async function fetchWithTransientRetry(
	input: RequestInfo | URL,
	init: RequestInit,
	options: TransientFetchRetryOptions = {},
): Promise<Response> {
	const fetcher = options.fetcher ?? fetch;
	const maxAttempts = options.maxAttempts ?? 3;
	const baseDelayMs = options.baseDelayMs ?? 300;
	const maxDelayMs = options.maxDelayMs ?? 5_000;
	const sleep = options.sleep ?? defaultSleep;

	if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
		throw new Error("Transient fetch retries require at least one attempt.");
	}

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const response = await fetcher(input, init);
			if (!isTransientResponse(response) || attempt === maxAttempts) {
				return response;
			}

			await sleep(getRetryDelayMs(response, attempt, baseDelayMs, maxDelayMs));
		} catch (error) {
			if (attempt === maxAttempts || !isTransientFetchError(error, init.signal)) {
				throw error;
			}
			await sleep(Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs));
		}
	}

	throw new Error("Transient fetch retry loop ended unexpectedly.");
}

export function isTransientResponse(response: Pick<Response, "status">): boolean {
	return transientStatuses.has(response.status) || response.status >= 500;
}

function isTransientFetchError(error: unknown, signal: AbortSignal | null | undefined): boolean {
	if (signal?.aborted) {
		return false;
	}
	return !(error instanceof DOMException && error.name === "AbortError");
}

function getRetryDelayMs(
	response: Response,
	attempt: number,
	baseDelayMs: number,
	maxDelayMs: number,
): number {
	const retryAfter = response.headers.get("Retry-After");
	if (retryAfter) {
		const seconds = Number(retryAfter);
		if (Number.isFinite(seconds) && seconds >= 0) {
			return Math.min(seconds * 1_000, maxDelayMs);
		}

		const timestamp = Date.parse(retryAfter);
		if (Number.isFinite(timestamp)) {
			return Math.min(Math.max(timestamp - Date.now(), 0), maxDelayMs);
		}
	}

	return Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
}

function defaultSleep(delayMs: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}
