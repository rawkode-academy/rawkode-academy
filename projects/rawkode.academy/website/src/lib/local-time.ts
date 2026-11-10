/**
 * Dates and times shown in the reader's own time zone.
 *
 * Pages are server-rendered and cached at the edge, so the server cannot know
 * the reader's time zone. Every date is rendered in UTC as a fallback and
 * carries its ISO instant plus the formatting it wants; the client script in
 * `src/scripts/local-time.ts` re-formats it in the browser's time zone.
 *
 * Calendar dates (a frontmatter value such as `publishedAt: 2026-10-01`, which
 * parses to midnight UTC) have no time of day. Shifting them would move the
 * day backwards for every reader west of Greenwich, so they stay in UTC.
 */

export const LOCAL_TIME_ATTRIBUTE = "data-local-time";

export interface LocalTimeSpec {
	locale: string;
	options: Intl.DateTimeFormatOptions;
}

export const isCalendarDate = (date: Date) =>
	date.getUTCHours() === 0 &&
	date.getUTCMinutes() === 0 &&
	date.getUTCSeconds() === 0 &&
	date.getUTCMilliseconds() === 0;

const toDate = (value: Date | string | number) =>
	value instanceof Date ? value : new Date(value);

// en-GB abbreviates September to four letters where every other month has
// three. One short form, so a column of dates stays aligned.
const shortMonths = (text: string) => text.replace(/\bSept\b/g, "Sep");

/** Format in UTC: the server-rendered fallback, identical for every reader. */
export const formatUtc = (
	value: Date | string | number,
	options: Intl.DateTimeFormatOptions,
	locale = "en-US",
) =>
	shortMonths(
		new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
			toDate(value),
		),
	);

/**
 * Format in a given zone (defaults to the runtime's own zone), keeping
 * calendar dates in UTC. Used by the client script and by client-rendered
 * components.
 */
export const formatLocal = (
	value: Date | string | number,
	options: Intl.DateTimeFormatOptions,
	locale = "en-US",
	timeZone?: string,
) => {
	const date = toDate(value);
	const { timeZone: _ignored, ...rest } = options;
	const zone = isCalendarDate(date) ? "UTC" : timeZone;
	return shortMonths(
		new Intl.DateTimeFormat(locale, {
			...rest,
			...(zone ? { timeZone: zone } : {}),
		}).format(date),
	);
};

/**
 * Text and attributes for an element whose date should follow the reader's
 * time zone. Spread `attrs` onto a `<time>` (or any element) and render
 * `text` inside it.
 */
export const localTime = (
	value: Date | string | number,
	options: Intl.DateTimeFormatOptions,
	locale = "en-US",
) => {
	const date = toDate(value);
	const { timeZone: _ignored, ...rest } = options;
	const spec: LocalTimeSpec = { locale, options: rest };
	return {
		text: formatUtc(date, rest, locale),
		iso: date.toISOString(),
		attrs: {
			datetime: date.toISOString(),
			[LOCAL_TIME_ATTRIBUTE]: JSON.stringify(spec),
		},
	};
};

export type LocalTimeValue = ReturnType<typeof localTime>;

/**
 * The Academy's one date form: day, short month, year ("17 Jul 2026"). Use
 * it wherever a publication date is set as metadata; ledger rows split the
 * same parts into a numeral and a label.
 */
export const ACADEMY_DATE_LOCALE = "en-GB";
export const ACADEMY_DATE = {
	day: "numeric",
	month: "short",
	year: "numeric",
} as const satisfies Intl.DateTimeFormatOptions;

export const localDate = (value: Date | string | number) =>
	localTime(value, ACADEMY_DATE, ACADEMY_DATE_LOCALE);

/** A scheduled start: "Wed 11 Nov 2026, 12:00 GMT" in the reader's zone. */
export const ACADEMY_DATE_TIME = {
	weekday: "short",
	day: "numeric",
	month: "short",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
	timeZoneName: "short",
} as const satisfies Intl.DateTimeFormatOptions;

export const localDateTime = (value: Date | string | number) =>
	localTime(value, ACADEMY_DATE_TIME, ACADEMY_DATE_LOCALE);
