const STORAGE_KEY = "klustered-timezone";

export const COMMON_TIMEZONES = [
	{ value: "UTC", label: "UTC" },
	{ value: "America/New_York", label: "Eastern Time (US)" },
	{ value: "America/Chicago", label: "Central Time (US)" },
	{ value: "America/Denver", label: "Mountain Time (US)" },
	{ value: "America/Los_Angeles", label: "Pacific Time (US)" },
	{ value: "America/Toronto", label: "Toronto" },
	{ value: "America/Sao_Paulo", label: "São Paulo" },
	{ value: "Europe/London", label: "London" },
	{ value: "Europe/Paris", label: "Paris" },
	{ value: "Europe/Berlin", label: "Berlin" },
	{ value: "Europe/Amsterdam", label: "Amsterdam" },
	{ value: "Europe/Stockholm", label: "Stockholm" },
	{ value: "Asia/Dubai", label: "Dubai" },
	{ value: "Asia/Kolkata", label: "India (IST)" },
	{ value: "Asia/Singapore", label: "Singapore" },
	{ value: "Asia/Tokyo", label: "Tokyo" },
	{ value: "Asia/Shanghai", label: "Shanghai" },
	{ value: "Asia/Seoul", label: "Seoul" },
	{ value: "Australia/Sydney", label: "Sydney" },
	{ value: "Australia/Melbourne", label: "Melbourne" },
	{ value: "Pacific/Auckland", label: "Auckland" },
] as const;

export type TimezoneOption = (typeof COMMON_TIMEZONES)[number];

export function getUserTimezone(): string {
	if (typeof window === "undefined") {
		return "UTC";
	}

	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored && isValidTimezone(stored)) {
		return stored;
	}

	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "UTC";
	}
}

export function setUserTimezone(timezone: string): void {
	if (typeof window === "undefined") return;

	if (isValidTimezone(timezone)) {
		localStorage.setItem(STORAGE_KEY, timezone);
	}
}

export function isValidTimezone(timezone: string): boolean {
	try {
		Intl.DateTimeFormat(undefined, { timeZone: timezone });
		return true;
	} catch {
		return false;
	}
}

export function formatInTimezone(
	date: Date | string | number | null | undefined,
	timezone: string,
	options?: Intl.DateTimeFormatOptions,
): string {
	if (!date) return "TBD";

	const d = new Date(date);
	if (Number.isNaN(d.getTime())) return "Invalid date";

	const defaultOptions: Intl.DateTimeFormatOptions = {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone,
		timeZoneName: "short",
	};

	try {
		return d.toLocaleString("en-US", { ...defaultOptions, ...options });
	} catch {
		return d.toLocaleString("en-US", defaultOptions);
	}
}

export function formatDateOnly(
	date: Date | string | number | null | undefined,
	timezone: string,
): string {
	if (!date) return "TBD";

	const d = new Date(date);
	if (Number.isNaN(d.getTime())) return "Invalid date";

	try {
		return d.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
			timeZone: timezone,
		});
	} catch {
		return d.toLocaleDateString("en-US");
	}
}

export function formatTimeOnly(
	date: Date | string | number | null | undefined,
	timezone: string,
): string {
	if (!date) return "TBD";

	const d = new Date(date);
	if (Number.isNaN(d.getTime())) return "Invalid date";

	try {
		return d.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			timeZone: timezone,
			timeZoneName: "short",
		});
	} catch {
		return d.toLocaleTimeString("en-US");
	}
}

export function getRelativeTime(
	date: Date | string | number | null | undefined,
): string {
	if (!date) return "";

	const d = new Date(date);
	if (Number.isNaN(d.getTime())) return "";

	const now = new Date();
	const diffMs = d.getTime() - now.getTime();
	const diffMins = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMs < 0) {
		const absMins = Math.abs(diffMins);
		const absHours = Math.abs(diffHours);
		const absDays = Math.abs(diffDays);

		if (absMins < 60) return `${absMins}m ago`;
		if (absHours < 24) return `${absHours}h ago`;
		return `${absDays}d ago`;
	}

	if (diffMins < 1) return "Now";
	if (diffMins < 60) return `in ${diffMins}m`;
	if (diffHours < 24) return `in ${diffHours}h`;
	if (diffDays < 7) return `in ${diffDays}d`;
	return `in ${Math.floor(diffDays / 7)}w`;
}

export function getCountdown(
	date: Date | string | number | null | undefined,
): { hours: number; minutes: number; seconds: number; isPast: boolean } | null {
	if (!date) return null;

	const d = new Date(date);
	if (Number.isNaN(d.getTime())) return null;

	const now = new Date();
	const diffMs = d.getTime() - now.getTime();
	const isPast = diffMs < 0;
	const absDiffMs = Math.abs(diffMs);

	const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
	const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
	const seconds = Math.floor((absDiffMs % (1000 * 60)) / 1000);

	return { hours, minutes, seconds, isPast };
}

export function formatCountdown(
	date: Date | string | number | null | undefined,
): string {
	const countdown = getCountdown(date);
	if (!countdown) return "";

	const { hours, minutes, isPast } = countdown;

	if (isPast) {
		if (hours < 1) return `${minutes}m elapsed`;
		return `${hours}h ${minutes}m elapsed`;
	}

	if (hours >= 24) {
		const days = Math.floor(hours / 24);
		const remainingHours = hours % 24;
		return `${days}d ${remainingHours}h`;
	}

	if (hours >= 1) {
		return `${hours}h ${minutes}m`;
	}

	return `${minutes}m`;
}

export function isWithinHours(
	date: Date | string | number | null | undefined,
	hours: number,
): boolean {
	if (!date) return false;

	const d = new Date(date);
	if (Number.isNaN(d.getTime())) return false;

	const now = new Date();
	const diffMs = d.getTime() - now.getTime();
	const diffHours = diffMs / (1000 * 60 * 60);

	return diffHours > 0 && diffHours <= hours;
}

export function generateICalEvent(event: {
	title: string;
	description?: string;
	startDate: Date;
	endDate?: Date;
	location?: string;
	url?: string;
}): string {
	const formatICalDate = (date: Date): string => {
		return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
	};

	const escapeText = (text: string): string => {
		return text.replace(/[\\;,\n]/g, (match) => {
			if (match === "\n") return "\\n";
			return `\\${match}`;
		});
	};

	const endDate = event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000);

	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Klustered//Competition//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		`DTSTART:${formatICalDate(event.startDate)}`,
		`DTEND:${formatICalDate(endDate)}`,
		`DTSTAMP:${formatICalDate(new Date())}`,
		`UID:${crypto.randomUUID()}@klustered.dev`,
		`SUMMARY:${escapeText(event.title)}`,
	];

	if (event.description) {
		lines.push(`DESCRIPTION:${escapeText(event.description)}`);
	}

	if (event.location) {
		lines.push(`LOCATION:${escapeText(event.location)}`);
	}

	if (event.url) {
		lines.push(`URL:${event.url}`);
	}

	lines.push("END:VEVENT", "END:VCALENDAR");

	return lines.join("\r\n");
}

export function generateGoogleCalendarUrl(event: {
	title: string;
	description?: string;
	startDate: Date;
	endDate?: Date;
	location?: string;
}): string {
	const formatGoogleDate = (date: Date): string => {
		return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
	};

	const endDate = event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000);

	const params = new URLSearchParams({
		action: "TEMPLATE",
		text: event.title,
		dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(endDate)}`,
	});

	if (event.description) {
		params.set("details", event.description);
	}

	if (event.location) {
		params.set("location", event.location);
	}

	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadICalFile(
	event: Parameters<typeof generateICalEvent>[0],
	filename = "match.ics",
): void {
	const icalContent = generateICalEvent(event);
	const blob = new Blob([icalContent], { type: "text/calendar;charset=utf-8" });
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
