/**
 * Pure logic for the content link audit: which GraphQL fields (or, for
 * articles, which repository files) hold links, how to pull URLs out of rich
 * text and Markdown, and how to turn link checks into a summary, findings and
 * a readable report.
 *
 * @module
 */
import type { LinkCheck } from "./technology.ts";

/** Where a URL was found. */
export interface Location {
	contentType: string;
	id: string;
	title: string;
	field: string;
}

/** One piece of content and every URL it holds. */
export interface ContentItem {
	contentType: string;
	id: string;
	title: string;
	links: Array<{ url: string; field: string }>;
}

/** A URL to request and everywhere it appears. */
export interface Target {
	url: string;
	internal: boolean;
	locations: Location[];
}

/** A checked URL that is not simply alive. */
export interface LinkFinding extends LinkCheck {
	url: string;
	internal: boolean;
	locations: Location[];
}

/** Totals for one run. */
export interface Summary {
	auditedAt: string;
	contentTypes: string[];
	maximumItems: number;
	includeInternal: boolean;
	items: number;
	itemsWithLinks: number;
	links: number;
	uniqueUrls: number;
	checked: number;
	internalSkipped: number;
	notLinks: number;
	ok: number;
	redirected: number;
	broken: number;
	blocked: number;
	error: number;
	byContentType: Record<
		string,
		{ items: number; links: number; broken: number; redirected: number }
	>;
}

type Row = Record<string, unknown>;

interface ContentType {
	/** The GraphQL selection that reads every row of this content type. */
	selection?: string;
	/**
	 * For content authored in the repository: the directory of Markdown/MDX
	 * files, relative to the repository root. Each file is a row of
	 * `{ id, source }`.
	 */
	directory?: string;
	/** Turn the rows into items with their links. */
	collect: (rows: Row[]) => ContentItem[];
}

/** The slug of a content file: its path without extension or `/index`. */
export function fileId(path: string): string {
	return path.replace(/\.mdx?$/, "").replace(/\/index$/, "");
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * Read a Markdown/MDX content file: its frontmatter title, the URLs its body
 * links to (Markdown links and images, autolinks and the URL attributes of
 * components; code is left out) and the URLs of its frontmatter resources.
 */
export function markdownLinks(
	source: string,
): { title: string; body: string[]; resources: string[] } {
	const match = source.match(FRONTMATTER);
	const frontmatter = match?.[1] ?? "";
	const title = frontmatter.match(/^title:\s*(.+)$/m)?.[1]?.trim()
		.replace(/^(["'])(.*)\1$/, "$2") ?? "";
	const resources = [...frontmatter.matchAll(/^\s+url:\s*(\S+)\s*$/gm)]
		.map((found) => found[1].replace(/^(["'])(.*)\1$/, "$2"));
	const prose = source.slice(match?.[0].length ?? 0)
		.replace(/^( {0,3})(`{3,}|~{3,})[\s\S]*?^\1\2[ \t]*$/gm, "")
		.replace(/`[^`\n]*`/g, "");
	const body = [
		...prose.matchAll(
			/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|<(https?:\/\/[^>\s]+)>|\b(?:href|src|lightSrc|darkSrc|thumbnailUrl)="([^"]+)"/g,
		),
	].map((found) => found[1] ?? found[2] ?? found[3]);
	return { title, body, resources };
}

const RESOURCES = "resources { url }";

function text(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function listed(value: unknown, field: string): ContentItem["links"] {
	return (Array.isArray(value) ? value : [])
		.filter((url): url is string => typeof url === "string" && url !== "")
		.map((url) => ({ url, field }));
}

function resources(value: unknown): ContentItem["links"] {
	return listed(
		(Array.isArray(value) ? value : []).map((resource) =>
			(resource as Row | null)?.url
		),
		"resources",
	);
}

function richText(value: unknown, field: string): ContentItem["links"] {
	return extractUrls(value).map((url) => ({ url, field }));
}

function item(
	contentType: string,
	row: Row,
	title: unknown,
	links: ContentItem["links"],
): ContentItem {
	return { contentType, id: text(row.id), title: text(title), links };
}

/** Every content type the audit can read, keyed by its input name. */
export const CONTENT_TYPES: Record<string, ContentType> = {
	// Articles are Markdown/MDX files in the repository, not gateway rows.
	articles: {
		directory: "content/articles",
		collect: (rows) =>
			rows.map((row) => {
				const found = markdownLinks(text(row.source));
				return item("articles", row, found.title, [
					...listed(found.body, "body"),
					...listed(found.resources, "resources"),
				]);
			}),
	},
	news: {
		selection: "allNewsStories { id title body }",
		collect: (rows) =>
			rows.map((row) =>
				item("news", row, row.title, richText(row.body, "body"))
			),
	},
	courses: {
		selection:
			`allCourses { id title body ${RESOURCES} modules { id title body ${RESOURCES} } }`,
		collect: (rows) =>
			rows.flatMap((row) => [
				item("courses", row, row.title, [
					...richText(row.body, "body"),
					...resources(row.resources),
				]),
				...(Array.isArray(row.modules) ? row.modules as Row[] : []).map(
					(module) =>
						item(
							"courses",
							module,
							`${text(row.title)}: ${text(module.title)}`,
							[
								...richText(module.body, "body"),
								...resources(module.resources),
							],
						),
				),
			]),
	},
	"learning-paths": {
		selection: "allLearningPaths { id title body }",
		collect: (rows) =>
			rows.map((row) =>
				item("learning-paths", row, row.title, richText(row.body, "body"))
			),
	},
	technologies: {
		selection:
			"allTechnologies { id name body learningResources { official community tutorials } }",
		collect: (rows) =>
			rows.map((row) => {
				const learning = (row.learningResources ?? {}) as Row;
				return item("technologies", row, row.name, [
					...richText(row.body, "body"),
					...listed(learning.official, "learningResources.official"),
					...listed(learning.community, "learningResources.community"),
					...listed(learning.tutorials, "learningResources.tutorials"),
				]);
			}),
	},
	videos: {
		selection: `getAllVideos { id title descriptionDoc ${RESOURCES} }`,
		collect: (rows) =>
			rows.map((row) =>
				item("videos", row, row.title, [
					...richText(row.descriptionDoc, "description"),
					...resources(row.resources),
				])
			),
	},
	changelog: {
		selection: "allChangelogEntries { id title description body }",
		collect: (rows) =>
			rows.map((row) =>
				item("changelog", row, row.title, [
					...richText(row.description, "description"),
					...richText(row.body, "body"),
				])
			),
	},
	"architecture-decision-records": {
		selection: "allAdrs { id title body }",
		collect: (rows) =>
			rows.map((row) =>
				item(
					"architecture-decision-records",
					row,
					row.title,
					richText(row.body, "body"),
				)
			),
	},
};

/** The content types audited when a run does not name any. */
export const DEFAULT_CONTENT_TYPES = [
	"articles",
	"news",
	"courses",
	"learning-paths",
	"technologies",
];

/** Split a comma-separated list of content types and reject unknown names. */
export function parseContentTypes(list: string): string[] {
	const names = [
		...new Set(
			list.split(",").map((name) => name.trim()).filter(Boolean),
		),
	];
	const unknown = names.filter((name) => !(name in CONTENT_TYPES));
	if (unknown.length > 0) {
		throw new Error(
			`Unknown content type: ${unknown.join(", ")}. Known: ${
				Object.keys(CONTENT_TYPES).join(", ")
			}`,
		);
	}
	return names.length > 0 ? names : DEFAULT_CONTENT_TYPES;
}

// Node and mark attributes that hold a URL in the rich-text schema: links,
// images (with their dark variant), embeds, diagrams and video posters.
const URL_ATTRIBUTES = ["href", "src", "darkSrc", "thumbnailUrl"];

/**
 * Walk a TipTap/ProseMirror document and return every URL it references, in
 * document order: link marks and the URL-bearing attributes of nodes.
 */
export function extractUrls(document: unknown): string[] {
	const urls: string[] = [];
	const visit = (node: unknown): void => {
		if (Array.isArray(node)) {
			node.forEach(visit);
			return;
		}
		if (typeof node !== "object" || node === null) return;
		const { attrs, marks, content } = node as Row;
		if (typeof attrs === "object" && attrs !== null) {
			for (const name of URL_ATTRIBUTES) {
				const value = (attrs as Row)[name];
				if (typeof value === "string" && value.trim() !== "") {
					urls.push(value.trim());
				}
			}
		}
		visit(marks);
		visit(content);
	};
	// The gateway serves some bodies as a JSON string rather than an object.
	if (typeof document === "string") {
		try {
			visit(JSON.parse(document));
		} catch {
			// Not a document.
		}
	} else {
		visit(document);
	}
	return urls;
}

/**
 * Decide what a raw link is: an external URL, one of the website's own, or
 * not a web link at all (anchors, mail, telephone). The fragment is dropped
 * so that anchors into one page are one request.
 */
export function resolveUrl(
	raw: string,
	websiteUrl: string,
): { url: string; internal: boolean } | null {
	const value = raw.trim();
	if (value === "" || value.startsWith("#")) return null;
	let url: URL;
	try {
		url = new URL(value, websiteUrl);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;
	url.hash = "";
	const website = new URL(websiteUrl).hostname;
	return {
		url: url.href,
		internal: url.hostname === website || url.hostname.endsWith(`.${website}`),
	};
}

/** De-duplicate the links of every item into one target per URL. */
export function collectTargets(
	items: ContentItem[],
	websiteUrl: string,
): { targets: Target[]; notLinks: number } {
	const targets = new Map<string, Target>();
	let notLinks = 0;
	for (const { contentType, id, title, links } of items) {
		for (const { url: raw, field } of links) {
			const resolved = resolveUrl(raw, websiteUrl);
			if (!resolved) {
				notLinks++;
				continue;
			}
			const target = targets.get(resolved.url) ??
				{ ...resolved, locations: [] };
			targets.set(resolved.url, target);
			if (
				!target.locations.some((location) =>
					location.contentType === contentType && location.id === id &&
					location.field === field
				)
			) {
				target.locations.push({ contentType, id, title, field });
			}
		}
	}
	return { targets: [...targets.values()], notLinks };
}

/**
 * Order targets so that consecutive requests go to different hosts where
 * possible, which keeps the load on any one site low.
 */
export function spreadByHost(targets: Target[]): Target[] {
	const hosts = new Map<string, Target[]>();
	for (const target of targets) {
		const host = new URL(target.url).hostname;
		hosts.set(host, [...(hosts.get(host) ?? []), target]);
	}
	const queues = [...hosts.values()];
	const ordered: Target[] = [];
	for (let round = 0; ordered.length < targets.length; round++) {
		for (const queue of queues) {
			if (round < queue.length) ordered.push(queue[round]);
		}
	}
	return ordered;
}

/**
 * A page that sends an anonymous visitor to a sign-in form has not moved; it
 * just cannot be verified without an account.
 */
export function refineCheck(check: LinkCheck): LinkCheck {
	if (check.state !== "redirected" || !check.finalUrl) return check;
	const { pathname } = new URL(check.finalUrl);
	return /^\/(login|signin|sign-in|sign_in)(\/|$)/i.test(pathname)
		? { state: "blocked", status: check.status, detail: "Requires signing in" }
		: check;
}

/** Turn the link checks into the run's totals and its list of findings. */
export function summarise(
	run: {
		auditedAt: string;
		contentTypes: string[];
		maximumItems: number;
		includeInternal: boolean;
		notLinks: number;
	},
	items: ContentItem[],
	targets: Target[],
	checks: Map<string, LinkCheck>,
): { summary: Summary; findings: LinkFinding[] } {
	const summary: Summary = {
		...run,
		items: items.length,
		itemsWithLinks: items.filter((entry) => entry.links.length > 0).length,
		links: items.reduce((total, entry) => total + entry.links.length, 0),
		uniqueUrls: targets.length,
		checked: 0,
		internalSkipped: 0,
		ok: 0,
		redirected: 0,
		broken: 0,
		blocked: 0,
		error: 0,
		byContentType: {},
	};
	for (const contentType of run.contentTypes) {
		const ofType = items.filter((entry) => entry.contentType === contentType);
		summary.byContentType[contentType] = {
			items: ofType.length,
			links: ofType.reduce((total, entry) => total + entry.links.length, 0),
			broken: 0,
			redirected: 0,
		};
	}
	const findings: LinkFinding[] = [];
	for (const target of targets) {
		const result = checks.get(target.url);
		const check = result && refineCheck(result);
		if (!check) {
			summary.internalSkipped++;
			continue;
		}
		summary.checked++;
		summary[check.state]++;
		if (check.state === "ok") continue;
		findings.push({ ...target, ...check });
		if (check.state === "broken" || check.state === "redirected") {
			for (
				const contentType of new Set(
					target.locations.map((location) => location.contentType),
				)
			) {
				summary.byContentType[contentType][check.state]++;
			}
		}
	}
	const order = ["broken", "redirected", "error", "blocked"];
	findings.sort((left, right) =>
		order.indexOf(left.state) - order.indexOf(right.state) ||
		left.url.localeCompare(right.url)
	);
	return { summary, findings };
}

function describeFinding(finding: LinkFinding): string {
	const status = finding.status ? ` (${finding.status})` : "";
	if (finding.state === "redirected") {
		return `<${finding.url}> now answers at <${finding.finalUrl}>`;
	}
	return `<${finding.url}>${status}` +
		(finding.detail ? `: ${finding.detail}` : "");
}

/** Render the findings as Markdown, grouped by the content item to fix. */
export function renderReport(
	summary: Summary,
	findings: LinkFinding[],
): string {
	const lines = [
		"# Content link audit",
		"",
		`Audited ${summary.items} items (${
			summary.contentTypes.join(", ")
		}) at ${summary.auditedAt}` +
		(summary.maximumItems > 0
			? `, limited to ${summary.maximumItems} per content type.`
			: "."),
		"",
		"| Links found | Unique URLs | Checked | Alive | Broken | Redirected | Blocked | Unreachable |",
		"| --- | --- | --- | --- | --- | --- | --- | --- |",
		`| ${summary.links} | ${summary.uniqueUrls} | ${summary.checked} | ${summary.ok} | ${summary.broken} | ${summary.redirected} | ${summary.blocked} | ${summary.error} |`,
		"",
	];
	if (summary.internalSkipped > 0) {
		lines.push(
			`Links to the website itself, not checked: ${summary.internalSkipped}.`,
			"",
		);
	}
	lines.push(
		"| Content type | Items | Links | Broken | Redirected |",
		"| --- | --- | --- | --- | --- |",
		...Object.entries(summary.byContentType).map(([contentType, counts]) =>
			`| ${contentType} | ${counts.items} | ${counts.links} | ${counts.broken} | ${counts.redirected} |`
		),
		"",
	);

	const sections: Array<[string, LinkFinding["state"][], string]> = [
		["Broken links", ["broken"], "No broken links."],
		["Redirected links", ["redirected"], "No redirected links."],
	];
	for (const [heading, states, nothing] of sections) {
		lines.push(`## ${heading}`, "");
		const groups = new Map<string, { title: string; entries: string[] }>();
		for (const finding of findings) {
			if (!states.includes(finding.state)) continue;
			for (const location of finding.locations) {
				const key = `${location.contentType}/${location.id}`;
				const group = groups.get(key) ??
					{ title: location.title, entries: [] };
				groups.set(key, group);
				group.entries.push(
					`- \`${location.field}\`: ${describeFinding(finding)}`,
				);
			}
		}
		if (groups.size === 0) {
			lines.push(nothing, "");
			continue;
		}
		for (const key of [...groups.keys()].sort()) {
			const group = groups.get(key)!;
			lines.push(`### ${group.title} (\`${key}\`)`, "", ...group.entries, "");
		}
	}

	const unverified = findings.filter((finding) =>
		finding.state === "blocked" || finding.state === "error"
	);
	if (unverified.length > 0) {
		lines.push(
			"## Could not be verified",
			"",
			"These refused an automated request or did not answer; check them by hand.",
			"",
			...unverified.map((finding) =>
				`- ${describeFinding(finding)} in ${
					finding.locations
						.map((location) => `\`${location.contentType}/${location.id}\``)
						.join(", ")
				}`
			),
			"",
		);
	}
	return lines.join("\n");
}
