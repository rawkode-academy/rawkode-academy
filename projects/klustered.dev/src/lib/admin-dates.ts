const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function parseOptionalUtcDate(value: string): number | null {
	if (!value) return null;
	if (!DATE_PATTERN.test(value)) throw new Error("invalid date");
	const timestamp = Date.parse(value + "T00:00:00.000Z");
	if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
		throw new Error("invalid date");
	}
	return timestamp;
}

export function parseOptionalUtcDateTime(dateValue: string, timeValue: string): number | null {
	if (!dateValue && !timeValue) return null;
	if (!dateValue || !timeValue || !TIME_PATTERN.test(timeValue)) {
		throw new Error("enter both a valid UTC date and time");
	}
	parseOptionalUtcDate(dateValue);
	const timestamp = Date.parse(dateValue + "T" + timeValue + ":00.000Z");
	if (!Number.isFinite(timestamp)) throw new Error("invalid date and time");
	return timestamp;
}

export function toUtcDateInput(value: Date | null | undefined): string {
	return value ? value.toISOString().slice(0, 10) : "";
}
