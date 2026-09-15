const UNITS: Record<string, number> = {
	ms: 1,
	s: 1_000,
	m: 60_000,
	h: 3_600_000,
};

/** Parse "15m", "90s", "500ms", "1h" or a bare number of milliseconds. */
export function parseDuration(input: string | number): number {
	if (typeof input === "number") return input;
	const m = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h)?\s*$/.exec(input);
	if (!m?.[1]) throw new Error(`Invalid duration: "${input}"`);
	const unit = m[2] ?? "ms";
	const factor = UNITS[unit];
	if (factor === undefined) throw new Error(`Invalid duration unit: "${unit}"`);
	return Math.round(Number.parseFloat(m[1]) * factor);
}

export function formatDuration(ms: number | null | undefined): string {
	if (ms === null || ms === undefined) return "-";
	if (ms < 1000) return `${ms}ms`;
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(1)}s`;
	const m = Math.floor(s / 60);
	const rem = Math.round(s - m * 60);
	return `${m}m${rem.toString().padStart(2, "0")}s`;
}

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
	new Promise((resolve) => {
		const t = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(t);
				resolve();
			},
			{ once: true },
		);
	});
