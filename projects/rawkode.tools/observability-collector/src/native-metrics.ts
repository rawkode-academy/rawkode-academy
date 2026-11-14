import {
	PermanentDeliveryError,
	RetryableDeliveryError,
} from "./delivery-queue";

export interface MetricObservation {
	name: string;
	value: number;
	attributes: Record<string, string>;
	timestamp: number;
}
export function validateMetric(metric: Omit<MetricObservation, "timestamp">) {
	if (
		typeof metric.name !== "string" ||
		metric.name.trim() !== metric.name ||
		!/^[A-Za-z][A-Za-z0-9_.\-/]{0,254}$/.test(metric.name) ||
		typeof metric.value !== "number" ||
		!Number.isFinite(metric.value) ||
		!metric.attributes ||
		typeof metric.attributes !== "object" ||
		Array.isArray(metric.attributes) ||
		Object.keys(metric.attributes).length > 20 ||
		Object.entries(metric.attributes).some(
			([key, value]) =>
				key.length > 128 || typeof value !== "string" || value.length > 512,
		)
	)
		throw new PermanentDeliveryError("invalid_payload");
}
function point(metric: MetricObservation) {
	validateMetric(metric);
	if (!Number.isSafeInteger(metric.timestamp) || metric.timestamp <= 0)
		throw new PermanentDeliveryError("invalid_payload");
	const nano = BigInt(metric.timestamp) * 1_000_000n;
	if (nano > 18446744073709551615n)
		throw new PermanentDeliveryError("invalid_payload");
	// Native labels are intentionally narrow. Do not create user/URL/free-text series.
	const repository = metric.attributes.repository;
	const attributes =
		repository &&
		repository.trim() === repository &&
		/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(repository)
			? [{ key: "repository", value: { stringValue: repository } }]
			: [];
	return {
		timeUnixNano: nano.toString(),
		asDouble: metric.value,
		attributes,
	};
}
export function metricsRequest(metrics: MetricObservation[]) {
	const grouped = new Map<string, ReturnType<typeof point>[]>();
	for (const metric of metrics) {
		const points = grouped.get(metric.name) ?? [];
		points.push(point(metric));
		grouped.set(metric.name, points);
	}
	return {
		resourceMetrics: [
			{
				resource: {
					attributes: [
						{
							key: "service.name",
							value: { stringValue: "observability-collector" },
						},
						{
							key: "service.namespace",
							value: { stringValue: "cloudflare-workers" },
						},
					],
				},
				scopeMetrics: [
					{
						scope: { name: "observability-collector" },
						metrics: [...grouped].map(([name, dataPoints]) => ({
							name,
							gauge: { dataPoints },
						})),
					},
				],
			},
		],
	};
}
function retryAfter(value: string | null): number | undefined {
	if (!value) return;
	const delay = /^\d+$/.test(value)
		? Number(value) * 1000
		: Date.parse(value) - Date.now();
	return Number.isFinite(delay) && delay >= 0 && delay <= 86_400_000
		? delay
		: undefined;
}
async function responsePayload(response: Response): Promise<unknown> {
	if (!response.body) throw new PermanentDeliveryError("invalid_response");
	const reader = response.body.getReader();
	let bytes = 0,
		text = "";
	const decoder = new TextDecoder();
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			bytes += next.value.byteLength;
			if (bytes > 8192) {
				await reader.cancel();
				throw new PermanentDeliveryError("invalid_response");
			}
			text += decoder.decode(next.value, { stream: true });
		}
		try {
			return JSON.parse(text + decoder.decode());
		} catch {
			throw new PermanentDeliveryError("invalid_response");
		}
	} finally {
		reader.releaseLock();
	}
}
export async function exportMetrics(
	config: { host: string; instanceId: string; token: string },
	metrics: MetricObservation[],
) {
	if (!metrics.length) return;
	const body = JSON.stringify(metricsRequest(metrics));
	const response = await fetch(`${config.host}/v1/metrics`, {
		method: "POST",
		signal: AbortSignal.timeout(15_000),
		redirect: "manual",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Basic ${btoa(`${config.instanceId}:${config.token}`)}`,
		},
		body,
	});
	if (response.status !== 200) {
		await response.body?.cancel();
		if ([429, 502, 503, 504].includes(response.status))
			throw new RetryableDeliveryError(
				retryAfter(response.headers.get("retry-after")),
			);
		throw new PermanentDeliveryError("rejected", response.status);
	}
	const payload = await responsePayload(response);
	if (!payload || typeof payload !== "object" || Array.isArray(payload))
		throw new PermanentDeliveryError("invalid_response");
	const responseBody = payload as {
		partialSuccess?: unknown;
		partial_success?: unknown;
	};
	if (
		responseBody.partialSuccess !== undefined &&
		responseBody.partial_success !== undefined
	)
		throw new PermanentDeliveryError("invalid_response");
	const partial =
		responseBody.partialSuccess !== undefined
			? responseBody.partialSuccess
			: responseBody.partial_success;
	if (partial === undefined) return;
	if (!partial || typeof partial !== "object" || Array.isArray(partial))
		throw new PermanentDeliveryError("invalid_response");
	const partialBody = partial as {
		rejectedDataPoints?: unknown;
		rejected_data_points?: unknown;
	};
	if (
		partialBody.rejectedDataPoints !== undefined &&
		partialBody.rejected_data_points !== undefined
	)
		throw new PermanentDeliveryError("invalid_response");
	const rejected =
		partialBody.rejectedDataPoints ?? partialBody.rejected_data_points ?? 0;
	if (
		!(
			typeof rejected === "number" &&
			Number.isSafeInteger(rejected) &&
			rejected >= 0
		) &&
		!(typeof rejected === "string" && /^\d+$/.test(rejected))
	)
		throw new PermanentDeliveryError("invalid_response");
	// OTLP forbids automatic retry after partial success. Retain for operator triage.
	if (BigInt(rejected) > 0n)
		throw new PermanentDeliveryError("partial_success");
}
