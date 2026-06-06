const MINUTE_MS = 60 * 1000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

type DateInput = Date | string | number;

const formatUnit = (value: number, unit: string) =>
	`${value} ${unit}${value === 1 ? "" : "s"}`;

export function formatStreamingCountdown(
	streamsAt: DateInput,
	now: DateInput = new Date(),
) {
	const streamsAtMs = new Date(streamsAt).getTime();
	const nowMs = new Date(now).getTime();
	const remainingMinutes = Math.ceil((streamsAtMs - nowMs) / MINUTE_MS);

	if (!Number.isFinite(remainingMinutes) || remainingMinutes <= 0) {
		return "Streaming soon";
	}

	const days = Math.floor(remainingMinutes / DAY_MINUTES);
	const hours = Math.floor((remainingMinutes % DAY_MINUTES) / HOUR_MINUTES);
	const minutes = remainingMinutes % HOUR_MINUTES;
	const parts: string[] = [];

	if (days > 0) {
		parts.push(formatUnit(days, "day"));
		if (hours > 0) parts.push(formatUnit(hours, "hour"));
	} else if (hours > 0) {
		parts.push(formatUnit(hours, "hour"));
		if (minutes > 0) parts.push(formatUnit(minutes, "minute"));
	} else {
		parts.push(formatUnit(minutes, "minute"));
	}

	return `Streaming in ${parts.join(", ")}`;
}
