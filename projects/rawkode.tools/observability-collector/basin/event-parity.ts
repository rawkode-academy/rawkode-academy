// Compare event identities, not totals: equal counts can conceal different events.
export const PAGE_SIZE = 1000;
export type Identity = {
	source: string;
	id: string;
	event: string;
	copies: number;
	versions: number;
};
export type Cursor = Pick<Identity, "source" | "id">;
const key = (row: Cursor) => JSON.stringify([row.source, row.id]);

export function identity(
	source: unknown,
	id: unknown,
	event: unknown,
	copies: unknown,
	versions: unknown,
): Identity {
	if (
		typeof source !== "string" ||
		!source ||
		typeof id !== "string" ||
		!id ||
		typeof event !== "string" ||
		!event
	)
		throw new Error("Missing CloudEvent identity or event name");
	const count = Number(copies),
		distinct = Number(versions);
	if (
		!Number.isSafeInteger(count) ||
		count < 1 ||
		!Number.isSafeInteger(distinct) ||
		distinct < 1 ||
		distinct > count
	)
		throw new Error("Invalid identity aggregation");
	return { source, id, event, copies: count, versions: distinct };
}

function literal(value: string, dialect: "basin" | "posthog") {
	if (/[\u0000-\u001f\u007f]/.test(value))
		throw new Error("Control character in pagination cursor");
	return dialect === "basin"
		? `'${value.replace(/'/g, "''")}'`
		: `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function afterCursor(
	cursor: Cursor | undefined,
	dialect: "basin" | "posthog",
) {
	if (!cursor) return "";
	const source =
		dialect === "basin" ? "event_source" : "properties.cloudevents_source";
	const id = dialect === "basin" ? "event_id" : "properties.cloudevents_id";
	return ` AND (${source} > ${literal(cursor.source, dialect)} OR (${source} = ${literal(cursor.source, dialect)} AND ${id} > ${literal(cursor.id, dialect)}))`;
}

const encoder = new TextEncoder();
function compareText(a: string, b: string) {
	const left = encoder.encode(a),
		right = encoder.encode(b);
	for (let index = 0; index < Math.min(left.length, right.length); index++) {
		const difference = left[index]! - right[index]!;
		if (difference) return difference;
	}
	return left.length - right.length;
}
function follows(row: Cursor, previous: Cursor) {
	return (
		compareText(row.source, previous.source) > 0 ||
		(row.source === previous.source && compareText(row.id, previous.id) > 0)
	);
}

export function crossDayIdentities(
	rows: Identity[],
	day: string,
	seen: Map<string, string>,
) {
	const conflicts = new Set<string>();
	for (const row of rows) {
		const id = key(row),
			previous = seen.get(id);
		if (previous && previous !== day) conflicts.add(id);
		else seen.set(id, day);
	}
	return conflicts.size;
}

// Bound each page under both providers' result limits and fail rather than
// certify a partial export. Keyset pagination avoids offset shifts before a
// cursor. Late arrivals still require a subsequent settled-day check.
export async function readIdentities(
	fetchPage: (cursor?: Cursor) => Promise<Identity[]>,
	maxPages = 100,
) {
	const result: Identity[] = [];
	const seen = new Set<string>();
	let cursor: Cursor | undefined;
	for (let page = 0; page <= maxPages; page++) {
		const rows = await fetchPage(cursor);
		if (rows.length > PAGE_SIZE || (page === maxPages && rows.length))
			throw new Error("Identity export exceeds the reconciliation bound");
		for (const row of rows) {
			const id = key(row);
			if (cursor && !follows(row, cursor))
				throw new Error("Identity pagination is not ordered");
			cursor = row;
			if (seen.has(id))
				throw new Error("Identity pagination repeated a record");
			seen.add(id);
			result.push(row);
		}
		if (rows.length < PAGE_SIZE) return result;
		cursor = rows.at(-1);
	}
	throw new Error("Incomplete identity export");
}

export function compareIdentities(posthog: Identity[], basin: Identity[]) {
	const ph = new Map(posthog.map((row) => [key(row), row]));
	const lake = new Map(basin.map((row) => [key(row), row]));
	if (ph.size !== posthog.length || lake.size !== basin.length)
		throw new Error("Ungrouped duplicate identity in reconciliation input");
	let missingInBasin = 0,
		missingInPosthog = 0,
		mismatchedEvents = 0,
		conflictingIdentities = 0;
	for (const id of new Set([...ph.keys(), ...lake.keys()])) {
		const p = ph.get(id),
			b = lake.get(id);
		if (!b) missingInBasin++;
		if (!p) missingInPosthog++;
		if (p && b && p.event !== b.event) mismatchedEvents++;
		if ((p?.versions ?? 0) > 1 || (b?.versions ?? 0) > 1)
			conflictingIdentities++;
	}
	const sourceCounts = new Map<
		string,
		{ source: string; posthog: number; basin: number }
	>();
	for (const [rows, provider] of [
		[posthog, "posthog"],
		[basin, "basin"],
	] as const) {
		for (const row of rows) {
			const counts = sourceCounts.get(row.source) ?? {
				source: row.source,
				posthog: 0,
				basin: 0,
			};
			counts[provider]++;
			sourceCounts.set(row.source, counts);
		}
	}
	const sources = [...sourceCounts.values()].sort((a, b) =>
		compareText(a.source, b.source),
	);
	return {
		posthog: ph.size,
		basin: lake.size,
		repeatedPosthog: posthog.reduce((sum, row) => sum + row.copies - 1, 0),
		repeatedBasin: basin.reduce((sum, row) => sum + row.copies - 1, 0),
		missingInBasin,
		missingInPosthog,
		mismatchedEvents,
		conflictingIdentities,
		sources,
		passed:
			ph.size > 0 &&
			lake.size > 0 &&
			missingInBasin === 0 &&
			missingInPosthog === 0 &&
			mismatchedEvents === 0 &&
			conflictingIdentities === 0,
	};
}
