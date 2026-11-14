import { PermanentDeliveryError } from "./delivery-queue";
import { acknowledgeOTLP } from "./otlp-response";

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
	await acknowledgeOTLP(response, "metrics");
}
