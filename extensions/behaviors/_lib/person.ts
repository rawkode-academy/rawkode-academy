/**
 * Pure rules for auditing a Rawkode Academy person (a row of the `people`
 * table in the `platform-people` D1 database) and their extra links (rows of
 * `people_links` in `platform-people-links`), and for turning the outcome into
 * a guarded SQL update. Nothing here performs I/O: the behavior gathers the
 * evidence and hands it in.
 *
 * @module
 */
import {
	type Change,
	comparableUrl,
	type Finding,
	type FindingStatus,
	type LinkCheck,
	planChanges as planFieldChanges,
	type Statement,
} from "./technology.ts";

/** Columns that hold a bare handle, with the profile URL each one expands to. */
const HANDLE_COLUMNS: Record<
	string,
	{ pattern: RegExp; profile: RegExp; site: string }
> = {
	github: {
		pattern: /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i,
		profile: /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)/i,
		site: "GitHub",
	},
	twitter: {
		pattern: /^\w{1,15}$/,
		profile: /^(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([^/?#]+)/i,
		site: "X",
	},
	bluesky: {
		pattern:
			/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z](?:[a-z\d-]{0,61}[a-z\d])?$/i,
		profile: /^(?:https?:\/\/)?bsky\.app\/profile\/([^/?#]+)/i,
		site: "Bluesky",
	},
	linkedin: {
		pattern: /^[\p{L}\p{N}%_-]{3,100}$/u,
		profile: /^(?:https?:\/\/)?(?:[a-z]+\.)?linkedin\.com\/in\/([^/?#]+)/i,
		site: "LinkedIn",
	},
};

/** Columns that hold a full URL. */
const URL_COLUMNS = ["mastodon", "website", "youtube"];

const NAME_COLUMNS = ["name", "forename", "surname"];

/** Every column a change may target. */
export const PERSON_COLUMNS = [
	...NAME_COLUMNS,
	...Object.keys(HANDLE_COLUMNS),
	...URL_COLUMNS,
];

/** Sites that refuse automated requests: their handles are never confirmed. */
const UNVERIFIABLE_COLUMNS = ["twitter", "linkedin"];

/** A people row; an empty column is `null`. */
export interface Person {
	id: string;
	updatedAt: number | null;
	columns: Record<string, string | null>;
}

/** What a site's own API says about an account. */
export interface AccountEvidence {
	state: "ok" | "missing" | "unavailable";
	/** The handle as the site spells it today. */
	handle?: string;
	source?: string;
	detail?: string;
}

/** Everything gathered about one person before they are evaluated. */
export interface PersonEvidence {
	github: AccountEvidence | null;
	bluesky: AccountEvidence | null;
	links: Record<string, LinkCheck>;
}

/** A people_links row. */
export interface PersonLink {
	personId: string;
	url: string;
	name: string;
	position: number;
}

/** The outcome of checking one extra link. Never written: review only. */
export interface LinkFinding {
	personId: string;
	url: string;
	name: string;
	status: FindingStatus;
	observed?: string;
	note?: string;
}

/** Parse a D1 people row. */
export function parseRow(row: Record<string, unknown>): Person {
	const columns: Record<string, string | null> = {};
	for (const column of PERSON_COLUMNS) {
		const value = row[column];
		columns[column] = value === null || value === undefined || value === ""
			? null
			: String(value);
	}
	const updatedAt = Number(row.updated_at);
	return {
		id: String(row.id),
		updatedAt: row.updated_at == null || Number.isNaN(updatedAt)
			? null
			: updatedAt,
		columns,
	};
}

/** Parse a D1 people_links row. */
export function parseLink(row: Record<string, unknown>): PersonLink {
	return {
		personId: String(row.person_id ?? ""),
		url: String(row.url ?? ""),
		name: String(row.name ?? ""),
		position: Number(row.position ?? 0),
	};
}

function isHttpUrl(value: unknown): value is string {
	if (typeof value !== "string") return false;
	try {
		return ["http:", "https:"].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}

function collapse(text: string): string {
	return text.trim().replace(/\s+/g, " ");
}

/**
 * The bare handle inside a profile URL or an `@`-prefixed value, or null when
 * nothing shaped like a handle for that column is left.
 */
export function extractHandle(column: string, value: string): string | null {
	const rule = HANDLE_COLUMNS[column];
	if (!rule) return null;
	const trimmed = value.trim();
	const handle = (trimmed.match(rule.profile)?.[1] ?? trimmed)
		.replace(/^@/, "");
	return rule.pattern.test(handle) ? handle : null;
}

/** Every URL of the person's row that needs a request to confirm it. */
export function linksToCheck(person: Person): string[] {
	return URL_COLUMNS.map((column) => person.columns[column])
		.filter(isHttpUrl);
}

/**
 * Why `value` cannot be stored in `column`, or null when it can. `null` clears
 * a column and is refused only where the profile needs a value.
 */
export function validateValue(column: string, value: unknown): string | null {
	if (!PERSON_COLUMNS.includes(column)) return `unknown field "${column}"`;
	if (value === null) {
		return column === "name" || column === "forename"
			? `"${column}" is required and cannot be cleared`
			: null;
	}
	if (typeof value !== "string" || value === "") {
		return `"${column}" must be a non-empty string or null`;
	}
	if (NAME_COLUMNS.includes(column)) {
		return collapse(value) === value
			? null
			: `"${column}" must not have leading, trailing or repeated spaces`;
	}
	if (URL_COLUMNS.includes(column)) {
		return isHttpUrl(value) ? null : `"${column}" must be an http(s) URL`;
	}
	return HANDLE_COLUMNS[column].pattern.test(value)
		? null
		: `"${column}" must be a bare ${
			HANDLE_COLUMNS[column].site
		} handle, not a URL or an @-prefixed value`;
}

/** Classify a requested URL; `redirected` carries the destination to review. */
function linkOutcome(
	current: string,
	check: LinkCheck | undefined,
): { status: FindingStatus; observed?: string | null; note?: string } {
	if (!check) return { status: "unverified", note: "not checked" };
	const detail = check.detail ??
		(check.status ? `HTTP ${check.status}` : undefined);
	switch (check.state) {
		case "ok":
			return { status: "verified", note: detail };
		case "redirected": {
			const final = check.finalUrl ?? current;
			if (/^consent\./.test(new URL(final).hostname)) {
				return { status: "unverified", note: "answered with a consent page" };
			}
			// Tracking hops only add a query string to the same page.
			const page = (url: string) => comparableUrl(url.replace(/[?#].*$/, ""));
			if (page(final) !== page(current)) {
				return { status: "redirected", observed: final, note: "redirects" };
			}
			return current.startsWith("http://") && final.startsWith("https://")
				? {
					status: "proposed",
					observed: final,
					note: "now served over HTTPS",
				}
				: { status: "verified", note: detail };
		}
		case "broken":
			return { status: "broken", observed: null, note: detail };
		default:
			return { status: "unverified", note: detail ?? check.state };
	}
}

function accountFinding(
	column: string,
	current: string,
	account: AccountEvidence | null,
): Finding {
	const base = { field: column, current, source: account?.source };
	if (!account || account.state === "unavailable") {
		return {
			...base,
			status: "unverified",
			note: account?.detail ?? "not checked",
		};
	}
	if (account.state === "missing") {
		return {
			...base,
			status: "broken",
			observed: null,
			note: account.detail ?? "no such account",
		};
	}
	const handle = account.handle ?? current;
	if (handle.toLowerCase() === current.toLowerCase()) {
		return {
			...base,
			status: "verified",
			note: handle === current
				? account.detail
				: `${HANDLE_COLUMNS[column].site} spells it ${handle}`,
		};
	}
	return {
		...base,
		status: "proposed",
		observed: handle,
		note: "account renamed",
	};
}

/**
 * Check every column of a person against the evidence. A handle the site
 * itself reports under a new name comes back `proposed`; everything else that
 * differs is reported with the observed value and applied only when accepted.
 */
export function evaluate(person: Person, evidence: PersonEvidence): Finding[] {
	const findings: Finding[] = [];
	const { columns } = person;

	// name, forename, surname
	for (const column of NAME_COLUMNS) {
		const value = columns[column];
		if (value !== null && collapse(value) !== value) {
			findings.push({
				field: column,
				status: "invalid",
				current: value,
				observed: collapse(value) || null,
				note: "leading, trailing or repeated spaces",
			});
		}
	}
	const forename = collapse(columns.forename ?? "");
	const surname = collapse(columns.surname ?? "");
	const composed = [forename, surname].filter(Boolean).join(" ");
	if (forename === "") {
		findings.push({
			field: "forename",
			status: "missing",
			current: columns.forename,
		});
	} else if (!findings.some((finding) => finding.field === "forename")) {
		findings.push({ field: "forename", status: "info", current: forename });
	}
	if (surname === "") {
		findings.push({
			field: "surname",
			status: "info",
			current: null,
			note: "single-name profile",
		});
	} else if (!findings.some((finding) => finding.field === "surname")) {
		findings.push({ field: "surname", status: "info", current: surname });
	}
	if (!findings.some((finding) => finding.field === "name")) {
		const name = columns.name;
		if (name === null) {
			findings.push({
				field: "name",
				status: "missing",
				current: null,
				...(composed ? { observed: composed } : {}),
				source: "forename and surname",
			});
		} else if (composed !== "" && name !== composed) {
			findings.push({
				field: "name",
				status: "mismatch",
				current: name,
				observed: composed,
				source: "forename and surname",
				note: "differs from forename and surname; may be a chosen display name",
			});
		} else {
			findings.push({
				field: "name",
				status: "verified",
				current: name,
				source: "forename and surname",
			});
		}
	}

	// github, twitter, bluesky, linkedin
	for (const [column, rule] of Object.entries(HANDLE_COLUMNS)) {
		const value = columns[column];
		if (value === null) continue;
		if (!rule.pattern.test(value)) {
			const handle = extractHandle(column, value);
			findings.push({
				field: column,
				status: "invalid",
				current: value,
				...(handle ? { observed: handle } : {}),
				note: `not a bare ${rule.site} handle`,
			});
		} else if (UNVERIFIABLE_COLUMNS.includes(column)) {
			findings.push({
				field: column,
				status: "unverified",
				current: value,
				note:
					`${rule.site} does not answer automated requests; only the shape was checked`,
			});
		} else {
			findings.push(
				accountFinding(
					column,
					value,
					evidence[column as "github" | "bluesky"],
				),
			);
		}
	}

	// mastodon, website, youtube
	for (const column of URL_COLUMNS) {
		const value = columns[column];
		if (value === null) continue;
		findings.push(
			isHttpUrl(value)
				? {
					field: column,
					current: value,
					source: "http",
					...linkOutcome(value, evidence.links[value]),
				}
				: {
					field: column,
					status: "invalid",
					current: value,
					note: "not an http(s) URL",
				},
		);
	}

	return findings;
}

/**
 * Check a person's extra links: shape, duplicates, an owner that exists and a
 * URL that answers. The outcome is reported for review and never written.
 */
export function evaluateLinks(
	links: PersonLink[],
	checks: Record<string, LinkCheck>,
	knownIdentifiers: string[],
): LinkFinding[] {
	const seen = new Set<string>();
	return links.map((link) => {
		const base = { personId: link.personId, url: link.url, name: link.name };
		const problems: string[] = [];
		if (!knownIdentifiers.includes(link.personId)) {
			problems.push("no person with this id");
		}
		if (link.name.trim() === "") problems.push("no name");
		if (!isHttpUrl(link.url)) {
			problems.push("not an http(s) URL");
		} else {
			const key = `${link.personId} ${comparableUrl(link.url)}`;
			if (seen.has(key)) problems.push("duplicate of another link");
			seen.add(key);
		}
		if (problems.length > 0) {
			return {
				...base,
				status: "invalid" as const,
				note: problems.join("; "),
			};
		}
		const outcome = linkOutcome(link.url, checks[link.url]);
		return {
			...base,
			// A link is never rewritten here, so an HTTPS upgrade is a redirect to review.
			status: outcome.status === "proposed" ? "redirected" : outcome.status,
			...(typeof outcome.observed === "string"
				? { observed: outcome.observed }
				: {}),
			...(outcome.note ? { note: outcome.note } : {}),
		};
	});
}

/**
 * Decide what to write for one person: every `proposed` finding, every
 * observed value named in `accept` (`field` or `id:field`), then the caller's
 * own `requested` values, which win. `used` reports the accept entries that
 * matched so the caller can refuse a typo.
 */
export function planChanges(
	person: Person,
	findings: Finding[],
	accept: string[],
	requested: Record<string, unknown>,
	used: Set<string> = new Set(),
): Change[] {
	return planFieldChanges(
		{ ...person, unparseable: [] },
		findings,
		accept,
		requested,
		used,
	);
}

/** The new value of every column the changes touch. */
export function applyChanges(
	changes: Change[],
): Record<string, string | null> {
	return Object.fromEntries(
		changes.map((change) => [change.field, change.to as string | null]),
	);
}

/**
 * An `UPDATE` of only the changed columns. It matches the row's `updated_at`
 * as audited, so a person edited since the audit is left alone.
 */
export function buildStatement(
	person: Person,
	columns: Record<string, string | null>,
): Statement {
	const assignments: string[] = [];
	const params: string[] = [];
	for (const [column, value] of Object.entries(columns)) {
		if (!PERSON_COLUMNS.includes(column)) {
			throw new Error(`Unknown people column "${column}"`);
		}
		if (value === null) {
			// surname is NOT NULL: a single-name profile stores an empty string.
			assignments.push(`${column} = ${column === "surname" ? "''" : "NULL"}`);
			continue;
		}
		params.push(value);
		assignments.push(`${column} = ?${params.length}`);
	}
	assignments.push("updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000");
	params.push(person.id, String(person.updatedAt ?? 0));
	return {
		sql:
			`UPDATE people SET ${assignments.join(", ")} WHERE id = ?${
				params.length - 1
			} ` +
			`AND coalesce(updated_at, 0) = CAST(?${params.length} AS INTEGER)`,
		params,
	};
}

/** Whether a stored column equals the value the plan expected to write. */
export function columnMatches(
	person: Person,
	column: string,
	expected: unknown,
): boolean {
	return (person.columns[column] ?? null) === (expected ?? null);
}
