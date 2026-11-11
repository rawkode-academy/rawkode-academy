/**
 * Pure rules for auditing a Rawkode Academy technology profile (a row of the
 * `technologies` table in the `platform-technologies` D1 database) and for
 * turning the outcome into a guarded SQL update. Nothing here performs I/O:
 * the behavior gathers the evidence and hands it in.
 *
 * @module
 */

/** Allowed values of the `status` column. */
export const TECHNOLOGY_STATUSES = [
	"alpha",
	"beta",
	"stable",
	"preview",
	"superseded",
	"deprecated",
	"abandoned",
] as const;

/** Allowed values of `cncf.status`. */
export const CNCF_STATUSES = [
	"sandbox",
	"incubating",
	"graduated",
	"archived",
] as const;

const MATRIX_STATUSES = [
	"skip",
	"watch",
	"explore",
	"learn",
	"adopt",
	"advocate",
	"graveyard",
	"guilty-pleasure",
] as const;
const MATRIX_GROUPINGS = [
	"plumbing",
	"platform",
	"observability",
	"security",
] as const;
const MATRIX_CONFIDENCES = [
	"gut",
	"some-experience",
	"deep-experience",
] as const;
const MATRIX_TRAJECTORIES = ["rising", "stable", "falling"] as const;

/** What a field holds, which decides how a new value is validated. */
type Kind =
	| "text"
	| "requiredText"
	| "url"
	| "date"
	| "flag"
	| "strings"
	| "urls"
	| "identifiers"
	| readonly string[];

const SCALAR_COLUMNS: Record<string, Kind> = {
	name: "requiredText",
	description: "requiredText",
	website: "url",
	documentation: "url",
	source: "url",
	license: "requiredText",
	status: TECHNOLOGY_STATUSES,
	category: "text",
	subcategory: "text",
};

const LIST_COLUMNS: Record<string, Kind> = {
	aliases: "strings",
	related_technologies: "identifiers",
	use_cases: "strings",
	features: "strings",
};

const OBJECT_COLUMNS: Record<string, Record<string, Kind>> = {
	learning_resources: {
		official: "urls",
		community: "urls",
		tutorials: "urls",
	},
	logos: { icon: "flag", horizontal: "flag", stacked: "flag" },
	cncf: {
		status: CNCF_STATUSES,
		accepted: "date",
		incubating: "date",
		graduated: "date",
		archived: "date",
		devStatsUrl: "url",
		annualReviewUrl: "url",
		personas: "strings",
		tags: "strings",
		useCase: "text",
		businessUseCase: "text",
		releaseRate: "text",
		integrations: "strings",
	},
	community: {
		twitter: "url",
		youtube: "url",
		slack: "url",
		discord: "url",
		chat: "url",
		blog: "url",
		mailingList: "url",
		githubDiscussions: "url",
	},
	matrix: {
		grouping: MATRIX_GROUPINGS,
		status: MATRIX_STATUSES,
		confidence: MATRIX_CONFIDENCES,
		trajectory: MATRIX_TRAJECTORIES,
		firstUsed: "text",
		lastUsed: "text",
		makesMeFeel: "text",
		why: "text",
		spicyTake: "text",
	},
	seo: { title: "text", description: "text" },
};

const JSON_COLUMNS = [
	...Object.keys(LIST_COLUMNS),
	...Object.keys(OBJECT_COLUMNS),
	"body",
];

/** Every field path a change may target, e.g. `license` or `community.twitter`. */
export const FIELD_KINDS: Record<string, Kind> = {
	...SCALAR_COLUMNS,
	...LIST_COLUMNS,
	...Object.fromEntries(
		Object.entries(OBJECT_COLUMNS).flatMap(([column, keys]) =>
			Object.entries(keys).map(([key, kind]) => [`${column}.${key}`, kind])
		),
	),
};

/** A technology row with its JSON columns parsed. */
export interface Technology {
	id: string;
	updatedAt: number | null;
	/** Column name to parsed value; `null` when the column is empty. */
	columns: Record<string, unknown>;
	/** JSON columns whose stored text did not parse. */
	unparseable: string[];
}

/** How a field held up against the evidence. */
export type FindingStatus =
	| "verified"
	| "proposed"
	| "redirected"
	| "mismatch"
	| "broken"
	| "missing"
	| "invalid"
	| "unverified"
	| "info";

/** The outcome of checking one field. `proposed` findings are applied. */
export interface Finding {
	field: string;
	status: FindingStatus;
	current: unknown;
	/** The value the evidence supports; present on anything that can be accepted. */
	observed?: unknown;
	source?: string;
	note?: string;
}

/** The result of requesting one URL. */
export interface LinkCheck {
	state: "ok" | "redirected" | "broken" | "blocked" | "error";
	status?: number;
	finalUrl?: string;
	detail?: string;
}

/** What the source repository's host says about it. */
export interface RepositoryEvidence {
	state: "ok" | "missing" | "unavailable";
	url?: string;
	archived?: boolean;
	license?: string | null;
	description?: string | null;
	discussions?: boolean;
	detail?: string;
}

/** Everything gathered about one technology before it is evaluated. */
export interface Evidence {
	/** False when the CNCF landscape could not be fetched. */
	landscapeAvailable: boolean;
	landscape: {
		item: Record<string, unknown>;
		matchedBy: "source" | "website" | "name";
	} | null;
	repository: RepositoryEvidence | null;
	links: Record<string, LinkCheck>;
	/** Whether each logo variant exists in the content bucket; null if unknown. */
	logos: Record<string, boolean | null>;
	knownIdentifiers: string[];
	websiteDescription: string | null;
}

/** One column-level edit that will be written. */
export interface Change {
	field: string;
	from: unknown;
	to: unknown;
	reason: "verified source" | "accepted" | "requested";
}

/** Parse a D1 row: JSON columns arrive as text. */
export function parseRow(row: Record<string, unknown>): Technology {
	const columns: Record<string, unknown> = {};
	const unparseable: string[] = [];
	for (const column of [...Object.keys(SCALAR_COLUMNS), ...JSON_COLUMNS]) {
		let value = row[column] === "" ? null : row[column] ?? null;
		if (JSON_COLUMNS.includes(column) && typeof value === "string") {
			try {
				value = JSON.parse(value);
			} catch {
				unparseable.push(column);
				value = null;
			}
		}
		columns[column] = value;
	}
	const updatedAt = Number(row.updated_at);
	return {
		id: String(row.id),
		updatedAt: row.updated_at == null || Number.isNaN(updatedAt)
			? null
			: updatedAt,
		columns,
		unparseable,
	};
}

/** Read a field path such as `community.twitter`; absent values are `null`. */
export function readField(technology: Technology, field: string): unknown {
	const [column, key] = field.split(".");
	const value = technology.columns[column] ?? null;
	if (key === undefined) return value;
	if (value === null || typeof value !== "object") return null;
	return (value as Record<string, unknown>)[key] ?? null;
}

/** Reduce a URL to a comparable form: no scheme, `www.`, case or trailing slash. */
export function comparableUrl(url: string): string {
	return url.trim().toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.replace(/^twitter\.com\//, "x.com/")
		.replace(/\.git$/, "")
		.replace(/[/#?]+$/, "");
}

/** The `owner/repository` of a GitHub URL, or null for anything else. */
export function githubRepository(url: unknown): string | null {
	if (typeof url !== "string") return null;
	const match = url.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
	return match ? `${match[1]}/${match[2].replace(/\.git$/, "")}` : null;
}

function deepEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function isHttpUrl(value: unknown): value is string {
	if (typeof value !== "string") return false;
	try {
		return ["http:", "https:"].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}

function isStringList(value: unknown): value is string[] {
	return Array.isArray(value) &&
		value.every((entry) => typeof entry === "string" && entry.trim() !== "") &&
		new Set(value).size === value.length;
}

/** Every URL of the profile that needs a request to confirm it. */
export function linksToCheck(technology: Technology): string[] {
	const urls = new Set<string>();
	const add = (value: unknown) => {
		if (isHttpUrl(value)) urls.add(value);
	};
	add(technology.columns.website);
	add(technology.columns.documentation);
	add(technology.columns.source);
	for (const key of Object.keys(OBJECT_COLUMNS.community)) {
		add(readField(technology, `community.${key}`));
	}
	for (const key of Object.keys(OBJECT_COLUMNS.learning_resources)) {
		const list = readField(technology, `learning_resources.${key}`);
		if (Array.isArray(list)) list.forEach(add);
	}
	return [...urls];
}

/**
 * Why `value` cannot be stored in `field`, or null when it can. `null` clears
 * a field and is refused only where the column is required.
 */
export function validateValue(
	field: string,
	value: unknown,
	knownIdentifiers: string[],
): string | null {
	const kind = FIELD_KINDS[field];
	if (kind === undefined) return `unknown field "${field}"`;
	if (value === null) {
		return kind === "requiredText" || field === "status" ||
				field === "matrix.status"
			? `"${field}" is required and cannot be cleared`
			: null;
	}
	if (Array.isArray(kind)) {
		return kind.includes(value as string)
			? null
			: `"${field}" must be one of ${kind.join(", ")}`;
	}
	switch (kind) {
		case "text":
		case "requiredText":
			return typeof value === "string" && value.trim() !== ""
				? null
				: `"${field}" must be a non-empty string`;
		case "url":
			return isHttpUrl(value) ? null : `"${field}" must be an http(s) URL`;
		case "date":
			return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
				? null
				: `"${field}" must be a YYYY-MM-DD date`;
		case "flag":
			return value === true ? null : `"${field}" must be true or null`;
		case "strings":
			return isStringList(value)
				? null
				: `"${field}" must be a list of unique non-empty strings`;
		case "urls":
			return isStringList(value) && value.every(isHttpUrl)
				? null
				: `"${field}" must be a list of unique http(s) URLs`;
		case "identifiers": {
			if (!isStringList(value)) {
				return `"${field}" must be a list of technology ids`;
			}
			const unknown = value.filter((id) => !knownIdentifiers.includes(id));
			return unknown.length === 0
				? null
				: `"${field}" names unknown technologies: ${unknown.join(", ")}`;
		}
	}
	return null;
}

function linkFinding(
	technology: Technology,
	field: string,
	evidence: Evidence,
	replacement?: unknown,
): Finding {
	const current = readField(technology, field) as string;
	const check = evidence.links[current];
	const base = { field, current, source: "http" };
	if (!check) return { ...base, status: "unverified", note: "not checked" };
	const detail = check.detail ??
		(check.status ? `HTTP ${check.status}` : undefined);
	switch (check.state) {
		case "ok":
			return { ...base, status: "verified", note: detail };
		case "redirected": {
			const final = check.finalUrl ?? current;
			// Consent and tracking hops only add a query string to the same page.
			const page = (url: string) => comparableUrl(url.replace(/[?#].*$/, ""));
			if (page(final) !== page(current)) {
				return {
					...base,
					status: "redirected",
					observed: final,
					note: "redirects",
				};
			}
			return current.startsWith("http://") && final.startsWith("https://")
				? {
					...base,
					status: "proposed",
					observed: final,
					note: "now served over HTTPS",
				}
				: { ...base, status: "verified", note: detail };
		}
		case "broken":
			return {
				...base,
				status: "broken",
				observed: replacement ?? null,
				note: detail,
			};
		default:
			return { ...base, status: "unverified", note: detail ?? check.state };
	}
}

const CNCF_FROM_LANDSCAPE: Record<
	string,
	(item: Record<string, unknown>) => unknown
> = {
	status: (item) => item.maturity,
	accepted: (item) => item.accepted_at,
	incubating: (item) => item.incubating_at,
	graduated: (item) => item.graduated_at,
	archived: (item) => item.archived_at,
	devStatsUrl: (item) => item.devstats_url,
	annualReviewUrl: (item) => item.latest_annual_review_url,
	personas: (item) => summary(item).personas,
	tags: (item) => summary(item).tags,
	useCase: (item) => summary(item).use_case,
	businessUseCase: (item) => summary(item).business_use_case,
	releaseRate: (item) => summary(item).release_rate,
	integrations: (item) => {
		const value = summary(item).integrations;
		return typeof value === "string"
			? value.split(",").map((entry) => entry.trim()).filter(Boolean)
			: value;
	},
};

const COMMUNITY_FROM_LANDSCAPE: Record<string, string> = {
	twitter: "twitter_url",
	youtube: "youtube_url",
	slack: "slack_url",
	discord: "discord_url",
	chat: "chat_channel",
	blog: "blog_url",
	mailingList: "mailing_list_url",
	githubDiscussions: "github_discussions_url",
};

function summary(item: Record<string, unknown>): Record<string, unknown> {
	return (item.summary ?? {}) as Record<string, unknown>;
}

/**
 * Check every field of a technology against the evidence. Fields backed by an
 * authoritative source (the repository host, the CNCF landscape, the content
 * bucket) come back `proposed` when they differ; everything else that differs
 * is reported with the observed value and applied only when accepted.
 */
export function evaluate(
	technology: Technology,
	evidence: Evidence,
): Finding[] {
	const findings: Finding[] = [];
	const current = (field: string) => readField(technology, field);
	const add = (
		field: string,
		status: FindingStatus,
		extra: Partial<Finding> = {},
	) => findings.push({ field, status, current: current(field), ...extra });
	const item = evidence.landscape?.item ?? null;
	const landscapeSource = evidence.landscape
		? `CNCF landscape (matched by ${evidence.landscape.matchedBy})`
		: undefined;
	// A name-only landscape match may be another product: never apply it unasked.
	const confident = evidence.landscape !== null &&
		evidence.landscape.matchedBy !== "name";
	const repository = evidence.repository;

	for (const column of technology.unparseable) {
		add(column, "invalid", { note: "stored value is not valid JSON" });
	}

	// name, description, body
	const name = current("name");
	if (typeof name !== "string" || name.trim() === "") {
		add("name", "invalid", { note: "empty" });
	} else if (item && String(item.name).toLowerCase() !== name.toLowerCase()) {
		add("name", "info", {
			note: `landscape calls it "${item.name}"`,
			source: landscapeSource,
		});
	} else {
		add("name", item ? "verified" : "info", { source: landscapeSource });
	}

	const description = current("description");
	const references = [
		repository?.description && `repository: ${repository.description}`,
		item?.description && `landscape: ${item.description}`,
		evidence.websiteDescription && `website: ${evidence.websiteDescription}`,
	].filter(Boolean).join(" | ");
	if (typeof description !== "string" || description.trim() === "") {
		add("description", "missing", {
			note: references || "no reference text found",
		});
	} else {
		add("description", "info", {
			current: `${description.length} characters`,
			note: references
				? `editorial; compare with ${references}`
				: "editorial; no reference text found",
		});
		const body = technology.columns.body as { type?: string } | null;
		if (body === null) {
			findings.push({
				field: "body",
				status: "proposed",
				current: null,
				observed: "rendered from description",
				source: "description",
			});
		} else if (body.type !== "doc") {
			findings.push({
				field: "body",
				status: "invalid",
				current: body.type ?? null,
				note: "not a rich-text document",
			});
		}
	}

	// website, documentation
	for (
		const [field, landscapeKey] of [["website", "homepage_url"], [
			"documentation",
			"documentation_url",
		]]
	) {
		const listed = item?.[landscapeKey];
		if (isHttpUrl(current(field))) {
			findings.push(linkFinding(technology, field, evidence, listed));
		} else if (current(field) !== null) {
			add(field, "invalid", { note: "not an http(s) URL" });
		} else if (isHttpUrl(listed)) {
			add(field, "missing", { observed: listed, source: landscapeSource });
		} else {
			add(field, "missing");
		}
	}

	// source
	const source = current("source");
	const listedRepository =
		((item?.repositories ?? []) as Array<Record<string, unknown>>)
			.find((entry) => entry.primary)?.url;
	if (source === null) {
		add(
			"source",
			"missing",
			isHttpUrl(listedRepository)
				? { observed: listedRepository, source: landscapeSource }
				: {},
		);
	} else if (!isHttpUrl(source)) {
		add("source", "invalid", { note: "not an http(s) URL" });
	} else if (repository?.state === "ok" && repository.url) {
		comparableUrl(repository.url) === comparableUrl(source)
			? add("source", "verified", { source: "repository host" })
			: add("source", "proposed", {
				observed: repository.url,
				source: "repository host",
				note: "repository moved",
			});
	} else if (repository?.state === "missing") {
		add("source", "broken", {
			observed: listedRepository ?? null,
			source: "repository host",
			note: "repository not found",
		});
	} else {
		findings.push(
			linkFinding(technology, "source", evidence, listedRepository),
		);
	}

	// license
	const license = current("license");
	if (repository?.license) {
		if (license === repository.license) {
			add("license", "verified", { source: "repository host" });
		} else {
			add(
				"license",
				license === "Unknown" || license === null ? "proposed" : "mismatch",
				{
					observed: repository.license,
					source: "repository host",
				},
			);
		}
	} else {
		add("license", "unverified", {
			note: repository?.detail ?? "no licence detected for the repository",
		});
	}

	// status
	const status = current("status") as string;
	const retired = ["superseded", "deprecated", "abandoned"].includes(status);
	if (
		!TECHNOLOGY_STATUSES.includes(status as typeof TECHNOLOGY_STATUSES[number])
	) {
		add("status", "invalid", {
			note: `must be one of ${TECHNOLOGY_STATUSES.join(", ")}`,
		});
	} else if (
		(repository?.archived || item?.maturity === "archived") && !retired
	) {
		add("status", "mismatch", {
			observed: "abandoned",
			source: repository?.archived ? "repository host" : landscapeSource,
			note: repository?.archived
				? "repository is archived"
				: "archived by the CNCF",
		});
	} else if (repository?.state === "ok") {
		add("status", "verified", {
			source: "repository host",
			note: repository.archived
				? "repository is archived"
				: "repository is active",
		});
	} else {
		add("status", "unverified", {
			note: "no repository state to compare with",
		});
	}

	// category, subcategory
	const placements = item
		? [
			item,
			...((item.additional_categories ?? []) as Array<Record<string, unknown>>),
		]
		: [];
	for (const field of ["category", "subcategory"]) {
		if (placements.length === 0) {
			add(field, "info", { note: "not in the CNCF landscape" });
		} else if (
			placements.some((placement) => placement[field] === current(field))
		) {
			add(field, "verified", { source: landscapeSource });
		} else {
			add(field, "mismatch", {
				observed: placements[0][field],
				source: landscapeSource,
			});
		}
	}

	// aliases, use cases, features, related technologies
	for (const field of ["aliases", "use_cases", "features"]) {
		const list = current(field);
		if (list === null) continue;
		isStringList(list)
			? add(field, "info", {
				current: `${list.length} entries`,
				note: "editorial",
			})
			: add(field, "invalid", {
				note: "must be a list of unique non-empty strings",
			});
	}
	const related = current("related_technologies");
	if (related !== null) {
		if (!isStringList(related)) {
			add("related_technologies", "invalid", {
				note: "must be a list of unique technology ids",
			});
		} else {
			const kept = related.filter((id) =>
				id !== technology.id && evidence.knownIdentifiers.includes(id)
			);
			kept.length === related.length
				? add("related_technologies", "verified", {
					source: "technologies table",
				})
				: add("related_technologies", "broken", {
					observed: kept.length > 0 ? kept : null,
					source: "technologies table",
					note: `unknown or self-referencing: ${
						related.filter((id) => !kept.includes(id)).join(", ")
					}`,
				});
		}
	}

	// learning resources
	for (const key of Object.keys(OBJECT_COLUMNS.learning_resources)) {
		const field = `learning_resources.${key}`;
		const list = current(field);
		if (list === null) continue;
		if (!isStringList(list) || !list.every(isHttpUrl)) {
			add(field, "invalid", { note: "must be a list of unique http(s) URLs" });
			continue;
		}
		const broken = list.filter((url) =>
			evidence.links[url]?.state === "broken"
		);
		const unconfirmed = list.filter((url) =>
			!["ok", "redirected", "broken"].includes(evidence.links[url]?.state ?? "")
		);
		if (broken.length > 0) {
			const kept = list.filter((url) => !broken.includes(url));
			add(field, "broken", {
				observed: kept.length > 0 ? kept : null,
				source: "http",
				note: `dead: ${broken.join(", ")}`,
			});
		} else if (unconfirmed.length > 0) {
			add(field, "unverified", {
				source: "http",
				note: `could not confirm: ${unconfirmed.join(", ")}`,
			});
		} else {
			add(field, "verified", { source: "http" });
		}
	}

	// logos
	for (const variant of Object.keys(OBJECT_COLUMNS.logos)) {
		const field = `logos.${variant}`;
		const flagged = current(field) === true;
		const exists = evidence.logos[variant];
		if (exists === null || exists === undefined) {
			if (flagged) {
				add(field, "unverified", { note: "content bucket did not answer" });
			}
		} else if (flagged === exists) {
			add(field, flagged ? "verified" : "info", {
				source: "content bucket",
				note: flagged ? undefined : "not uploaded",
			});
		} else {
			add(field, "proposed", {
				observed: exists ? true : null,
				source: "content bucket",
				note: exists
					? "file exists but the flag is unset"
					: "flag is set but the file is missing",
			});
		}
	}

	// cncf
	const cncfStatus = current("cncf.status");
	if (!evidence.landscapeAvailable) {
		if (technology.columns.cncf !== null) {
			add("cncf", "unverified", { note: "CNCF landscape unavailable" });
		}
	} else if (item?.maturity) {
		for (const [key, read] of Object.entries(CNCF_FROM_LANDSCAPE)) {
			const field = `cncf.${key}`;
			const listed = read(item) ?? null;
			const stored = current(field);
			if (listed === null && stored === null) continue;
			if (deepEqual(listed, stored)) {
				add(field, "verified", { source: landscapeSource });
			} else if (listed === null) {
				add(field, "info", {
					source: landscapeSource,
					note: "not in the landscape entry",
				});
			} else {
				add(field, confident ? "proposed" : "mismatch", {
					observed: listed,
					source: landscapeSource,
				});
			}
		}
	} else if (cncfStatus !== null) {
		add("cncf.status", "mismatch", {
			note: "no CNCF project in the landscape matches this technology",
		});
	} else {
		add("cncf", "info", { current: null, note: "not a CNCF project" });
	}

	// community
	for (const [key, landscapeKey] of Object.entries(COMMUNITY_FROM_LANDSCAPE)) {
		const field = `community.${key}`;
		const stored = current(field);
		let listed = item?.[landscapeKey] ?? null;
		if (
			key === "githubDiscussions" && listed === null &&
			repository?.discussions && repository.url
		) {
			listed = `${repository.url}/discussions`;
		}
		if (!isHttpUrl(listed)) listed = null;
		if (stored === null) {
			if (listed !== null) {
				add(
					field,
					confident || key === "githubDiscussions" ? "proposed" : "missing",
					{
						observed: listed,
						source: item?.[landscapeKey] ? landscapeSource : "repository host",
					},
				);
			}
			continue;
		}
		if (!isHttpUrl(stored)) {
			add(field, "invalid", { observed: listed, note: "not an http(s) URL" });
			continue;
		}
		if (
			listed !== null &&
			comparableUrl(listed as string) === comparableUrl(stored)
		) {
			add(field, "verified", { source: landscapeSource ?? "repository host" });
			continue;
		}
		const finding = linkFinding(technology, field, evidence, listed);
		if (listed !== null && finding.status === "unverified") {
			finding.status = "mismatch";
			finding.observed = listed;
			finding.source = landscapeSource;
		} else if (listed !== null && finding.status === "verified") {
			finding.note = `reachable; the landscape lists ${listed}`;
		}
		findings.push(finding);
	}

	// matrix, seo
	const matrix = technology.columns.matrix as Record<string, unknown> | null;
	if (matrix !== null) {
		const problems = Object.entries(OBJECT_COLUMNS.matrix)
			.filter(([key, kind]) =>
				Array.isArray(kind) && (matrix[key] != null || key === "status")
			)
			.map(([key]) => validateValue(`matrix.${key}`, matrix[key] ?? null, []))
			.filter(Boolean);
		problems.length > 0
			? add("matrix", "invalid", { note: problems.join("; ") })
			: add("matrix", "info", {
				current: matrix.status,
				note: "editorial opinion; values are valid",
			});
	}
	const seo = technology.columns.seo as Record<string, unknown> | null;
	if (seo !== null) {
		const title = String(seo.title ?? "");
		const text = String(seo.description ?? "");
		const notes = [
			title.length > 60 &&
			`title is ${title.length} characters (60 recommended)`,
			text.length > 160 &&
			`description is ${text.length} characters (160 recommended)`,
		].filter(Boolean);
		add("seo", "info", {
			current: undefined,
			note: notes.join("; ") || "lengths are within search-result limits",
		});
	}

	return findings;
}

/**
 * Decide what to write for one technology: every `proposed` finding, every
 * observed value named in `accept` (`field` or `id:field`), then the caller's
 * own `requested` values, which win. `used` reports the accept entries that
 * matched so the caller can refuse a typo.
 */
export function planChanges(
	technology: Technology,
	findings: Finding[],
	accept: string[],
	requested: Record<string, unknown>,
	used: Set<string> = new Set(),
): Change[] {
	const changes = new Map<string, Change>();
	for (const finding of findings) {
		if (finding.observed === undefined) continue;
		const accepted = [finding.field, `${technology.id}:${finding.field}`]
			.filter((entry) => accept.includes(entry));
		accepted.forEach((entry) => used.add(entry));
		if (finding.status !== "proposed" && accepted.length === 0) continue;
		changes.set(finding.field, {
			field: finding.field,
			from: finding.current,
			to: finding.observed,
			reason: finding.status === "proposed" ? "verified source" : "accepted",
		});
	}
	for (const [field, to] of Object.entries(requested)) {
		changes.set(field, {
			field,
			from: readField(technology, field),
			to,
			reason: "requested",
		});
	}
	return [...changes.values()].filter((change) =>
		change.field === "body" || !deepEqual(change.from, change.to)
	);
}

/**
 * The new value of every column the changes touch. Object columns are merged
 * key by key and become `null` once empty. `body` is supplied by the caller,
 * which renders it from the description.
 */
export function applyChanges(
	technology: Technology,
	changes: Change[],
	body?: unknown,
): Record<string, unknown> {
	const columns: Record<string, unknown> = {};
	for (const change of changes) {
		const [column, key] = change.field.split(".");
		if (column === "body") continue;
		if (key === undefined) {
			columns[column] = change.to;
			continue;
		}
		// An object emptied by an earlier change is null here: do not fall back to the row.
		const base = column in columns
			? columns[column]
			: technology.columns[column];
		const merged = { ...((base ?? {}) as Record<string, unknown>) };
		if (change.to === null) delete merged[key];
		else merged[key] = change.to;
		columns[column] = Object.keys(merged).length > 0 ? merged : null;
	}
	if (body !== undefined) columns.body = body;
	return columns;
}

/** A parameterised statement for the D1 query API. */
export interface Statement {
	sql: string;
	params: string[];
}

/**
 * An `UPDATE` of only the changed columns. It matches the row's `updated_at`
 * as audited, so a profile edited since the audit is left alone.
 */
export function buildStatement(
	technology: Technology,
	columns: Record<string, unknown>,
): Statement {
	const assignments: string[] = [];
	const params: string[] = [];
	for (const [column, value] of Object.entries(columns)) {
		if (value === null) {
			assignments.push(`${column} = NULL`);
			continue;
		}
		params.push(typeof value === "string" ? value : JSON.stringify(value));
		assignments.push(`${column} = ?${params.length}`);
	}
	assignments.push("updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000");
	params.push(technology.id, String(technology.updatedAt ?? 0));
	return {
		sql:
			`UPDATE technologies SET ${assignments.join(", ")} WHERE id = ?${
				params.length - 1
			} ` +
			`AND coalesce(updated_at, 0) = CAST(?${params.length} AS INTEGER)`,
		params,
	};
}

/** Whether a stored column equals the value the plan expected to write. */
export function columnMatches(
	technology: Technology,
	column: string,
	expected: unknown,
): boolean {
	return deepEqual(technology.columns[column], expected);
}
