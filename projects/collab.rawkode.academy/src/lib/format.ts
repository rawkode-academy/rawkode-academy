export const formatTimestamp = (ms: number): string => {
	const total = Math.floor(ms / 1000);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

export const STATE_LABEL: Record<string, string> = {
	in_review: "In review",
	changes_requested: "Changes requested",
	approved: "Signed off",
	scheduled: "Scheduled",
	published: "Published",
};

export const localDate = (iso: string): string =>
	new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const numbers = new Intl.NumberFormat("en-GB");
export const count = (value: number): string => numbers.format(value);
/** Minutes watched as hours, one decimal under 100 hours. */
export const hours = (minutes: number): string => {
	const h = minutes / 60;
	return `${h < 100 ? (Math.round(h * 10) / 10).toString() : numbers.format(Math.round(h))} h`;
};
