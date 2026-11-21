/** Producer acknowledgement only. Retries are bounded and are not a durable outbox. */
export type AnalyticsReceipt = {
	version: 1;
	event_source: string;
	event_id: string;
	disposition: "persisted" | "filtered";
};
export type AnalyticsDelivery = {
	event_source: string;
	event_id: string;
	attempts: number;
} & (
	| { status: "accepted" | "filtered"; receipt: AnalyticsReceipt }
	| {
			status: "failed";
			reason: "unbound" | "rejected" | "unavailable" | "unconfirmed";
			http_status?: number;
	  }
);
const BUDGET_MS = 2000;
const ATTEMPT_MS = 600;
const MAX_ATTEMPTS = 3;
const MAX_RECEIPT_BYTES = 8192;

async function receiptBody(response: Response): Promise<unknown> {
	if (!response.body) return;
	const reader = response.body.getReader();
	try {
		let bytes = 0,
			text = "";
		const decoder = new TextDecoder();
		while (true) {
			const part = await reader.read();
			if (part.done) break;
			bytes += part.value.byteLength;
			if (bytes > MAX_RECEIPT_BYTES) {
				await reader.cancel();
				return;
			}
			text += decoder.decode(part.value, { stream: true });
		}
		return JSON.parse(text + decoder.decode());
	} catch {
		return;
	} finally {
		reader.releaseLock();
	}
}
function matchingReceipt(
	payload: unknown,
	event: { source: string; id: string },
): AnalyticsReceipt | undefined {
	if (!payload || typeof payload !== "object") return;
	const body = payload as {
		success?: unknown;
		receipt?: Partial<AnalyticsReceipt>;
	};
	const receipt = body.receipt;
	if (
		body.success === true &&
		receipt?.version === 1 &&
		receipt.event_source === event.source &&
		receipt.event_id === event.id &&
		(receipt.disposition === "persisted" || receipt.disposition === "filtered")
	)
		return receipt as AnalyticsReceipt;
	return;
}

export async function deliverAnalyticsEvent(
	analytics: Pick<Fetcher, "fetch"> | undefined,
	event: { source: string; id: string },
	attributes: readonly string[],
): Promise<AnalyticsDelivery> {
	const identity = { event_source: event.source, event_id: event.id };
	if (!analytics) {
		const result = {
			...identity,
			attempts: 0,
			status: "failed",
			reason: "unbound",
		} as const;
		console.warn("analytics.producer.failed", result);
		return result;
	}
	// Serialize once: ambiguous acknowledgement must never mint another event ID.
	let body: string;
	try {
		body = JSON.stringify({ event, attributes });
	} catch {
		const result = {
			...identity,
			attempts: 0,
			status: "failed",
			reason: "rejected",
		} as const;
		console.warn("analytics.producer.failed", result);
		return result;
	}
	const deadline = Date.now() + BUDGET_MS;
	let attempts = 0,
		reason: "rejected" | "unavailable" | "unconfirmed" = "unavailable";
	let httpStatus: number | undefined;
	while (attempts < MAX_ATTEMPTS && Date.now() < deadline) {
		attempts++;
		const controller = new AbortController();
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			const outcome = await Promise.race([
				(async () => {
					const response = await analytics.fetch(
						"https://analytics.internal/track",
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body,
							signal: controller.signal,
							redirect: "manual",
						},
					);
					const status = response.status;
					if (response.status !== 200) {
						await response.body?.cancel();
						return {
							httpStatus: status,
							retry:
								response.ok ||
								[408, 425, 429].includes(status) ||
								status >= 500,
							reason: response.ok
								? "unconfirmed"
								: [408, 425, 429].includes(status) || status >= 500
									? "unavailable"
									: "rejected",
						} as const;
					}
					const receipt = matchingReceipt(await receiptBody(response), event);
					return receipt
						? { receipt, httpStatus: status }
						: ({
								httpStatus: status,
								retry: true,
								reason: "unconfirmed",
							} as const);
				})(),
				new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => {
							controller.abort();
							reject(new Error("Analytics acknowledgement deadline"));
						},
						Math.min(ATTEMPT_MS, deadline - Date.now()),
					);
				}),
			]);
			httpStatus = outcome.httpStatus;
			if ("receipt" in outcome && outcome.receipt) {
				const result = {
					...identity,
					attempts,
					status:
						outcome.receipt.disposition === "persisted"
							? "accepted"
							: "filtered",
					receipt: outcome.receipt,
				} as const;
				console.info("analytics.producer.acknowledged", result);
				return result;
			}
			reason = outcome.reason;
			if (!outcome.retry) break;
		} catch {
			reason = "unavailable";
		} finally {
			if (timer) clearTimeout(timer);
		}
		if (attempts < MAX_ATTEMPTS) {
			const wait = Math.min(100 * 2 ** (attempts - 1), deadline - Date.now());
			if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		}
	}
	const result = {
		...identity,
		attempts,
		status: "failed",
		reason,
		...(httpStatus === undefined ? {} : { http_status: httpStatus }),
	} as const;
	// Never log response/error bodies or event data (including identity/profile data).
	console.warn("analytics.producer.failed", result);
	return result;
}
