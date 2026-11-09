export interface BroadcastEventSource {
	startDate: string;
	durationSeconds?: number | undefined;
}

/**
 * Google's livestream markup: a live video names its broadcast in
 * `publication`, which gives scheduled streams a machine-readable start time.
 */
export function buildBroadcastEventJsonLd(
	source: BroadcastEventSource,
): Record<string, unknown> {
	const { startDate, durationSeconds } = source;
	const startTime = new Date(startDate).getTime();
	const endDate =
		typeof durationSeconds === "number" &&
		Number.isFinite(durationSeconds) &&
		durationSeconds > 0 &&
		Number.isFinite(startTime)
			? new Date(startTime + durationSeconds * 1000).toISOString()
			: undefined;

	return {
		"@type": "BroadcastEvent",
		isLiveBroadcast: true,
		startDate,
		...(endDate ? { endDate } : {}),
	};
}
