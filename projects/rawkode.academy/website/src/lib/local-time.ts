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

/** Format in UTC: the server-rendered fallback, identical for every reader. */
export const formatUtc = (
	value: Date | string | number,
	options: Intl.DateTimeFormatOptions,
	locale = "en-US",
) =>
	new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
		toDate(value),
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
	return new Intl.DateTimeFormat(locale, {
		...rest,
		...(zone ? { timeZone: zone } : {}),
	}).format(date);
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
