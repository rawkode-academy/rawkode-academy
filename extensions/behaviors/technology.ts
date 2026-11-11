/**
 * Audits Rawkode Academy technology profiles (rows of the `technologies`
 * table in the `platform-technologies` D1 database) against primary sources
 * and plans the update. D1 itself is read and written by the
 * `@webframp/cloudflare/d1` behavior and search-result text is drafted by
 * `@keeb/anthropic/claude`; this one decides what to write.
 *
 * @module
 */
import { z } from "npm:zod@4";
import {
	applyChanges,
	buildStatement,
	type Change,
	columnMatches,
	comparableUrl,
	evaluate,
	type Evidence,
	type Finding,
	githubRepository,
	linksToCheck,
	parseRow,
	planChanges,
	type RepositoryEvidence,
	reviewDraft,
	SEO_DRAFT_SCHEMA,
	SEO_SYSTEM_PROMPT,
	seoFieldsToDraft,
	seoPrompt,
	type Statement,
	type Technology,
	uncovered,
	validateValue,
} from "./_lib/technology.ts";
import { checkLink, inParallel, request } from "./_lib/http.ts";

const LANDSCAPE_URL = "https://landscape.cncf.io/data/full.json";

// The landscape names licences in prose; these are the ones it uses most.
const LICENSE_IDENTIFIERS: Record<string, string> = {
	"Apache License 2.0": "Apache-2.0",
	"MIT License": "MIT",
	'BSD 3-Clause "New" or "Revised" License': "BSD-3-Clause",
	'BSD 2-Clause "Simplified" License': "BSD-2-Clause",
	"Mozilla Public License 2.0": "MPL-2.0",
	"GNU General Public License v2.0": "GPL-2.0",
	"GNU General Public License v3.0": "GPL-3.0",
	"GNU Affero General Public License v3.0": "AGPL-3.0",
	"GNU Lesser General Public License v2.1": "LGPL-2.1",
	"GNU Lesser General Public License v3.0": "LGPL-3.0",
	"ISC License": "ISC",
};

const GlobalArgsSchema = z.object({
	contentUrl: z.string().url().default("https://content.rawkode.academy")
		.describe("Public base URL of the content bucket that holds the logos"),
	websiteUrl: z.string().url().default("https://rawkode.academy")
		.describe("Website whose cache is invalidated after a write"),
});
type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const FindingSchema = z.object({
	field: z.string(),
	status: z.string(),
	current: z.unknown().optional(),
	observed: z.unknown().optional(),
	source: z.string().optional(),
	note: z.string().optional(),
});

const ChangeSchema = z.object({
	field: z.string(),
	from: z.unknown().optional(),
	to: z.unknown().optional(),
	reason: z.string(),
});

const AuditSchema = z.object({
	id: z.string(),
	auditedAt: z.string(),
	counts: z.record(z.string(), z.number()),
	findings: z.array(FindingSchema),
	changes: z.array(ChangeSchema),
});

const DraftingSchema = z.object({
	createdAt: z.string(),
	systemPrompt: z.string(),
	requests: z.array(z.object({
		key: z.string(),
		prompt: z.string(),
		jsonSchema: z.record(z.string(), z.unknown()),
	})),
});

const PlanSchema = z.object({
	createdAt: z.string(),
	audited: z.number(),
	technologies: z.array(z.string()),
	statements: z.array(
		z.object({ sql: z.string(), params: z.array(z.string()) }),
	),
	expected: z.record(z.string(), z.record(z.string(), z.unknown())),
	needsReview: z.number(),
	summary: z.string(),
});
type Plan = z.infer<typeof PlanSchema>;

const GapsSchema = z.object({
	checkedAt: z.string(),
	maturity: z.array(z.string()),
	projects: z.number(),
	missing: z.array(z.object({
		name: z.string(),
		maturity: z.string(),
		accepted: z.string().nullable(),
		category: z.string().nullable(),
		subcategory: z.string().nullable(),
		website: z.string().nullable(),
		source: z.string().nullable(),
		description: z.string().nullable(),
	})),
});

const ConfirmationSchema = z.object({
	confirmedAt: z.string(),
	technologies: z.array(z.string()),
	columns: z.number(),
});

const InvalidationSchema = z.object({
	invalidatedAt: z.string(),
	tags: z.array(z.string()),
	status: z.number(),
});

const RowsSchema = z.array(z.record(z.string(), z.unknown()))
	.describe("Rows of the technologies table as returned by D1");

interface Context {
	globalArgs: GlobalArgs;
	repoDir: string;
	logger: {
		info: (message: string, properties: Record<string, unknown>) => void;
	};
	writeResource: (
		specName: string,
		name: string,
		data: Record<string, unknown>,
	) => Promise<{ name: string }>;
	readResource?: (name: string) => Promise<Record<string, unknown> | null>;
}

interface Landscape {
	bySource: Map<string, Record<string, unknown>>;
	byWebsite: Map<string, Record<string, unknown>>;
	byName: Map<string, Record<string, unknown>>;
	repositories: Record<string, Record<string, unknown>>;
	/** Every CNCF project: the landscape items that have a maturity. */
	projects: Array<Record<string, unknown>>;
}

async function fetchLandscape(): Promise<Landscape | null> {
	try {
		const response = await request(LANDSCAPE_URL);
		if (!response.ok) return null;
		const data = await response.json() as {
			items: Array<Record<string, unknown>>;
			github_data?: Record<string, Record<string, unknown>>;
		};
		const landscape: Landscape = {
			bySource: new Map(),
			byWebsite: new Map(),
			byName: new Map(),
			repositories: {},
			projects: data.items.filter((item) => !!item.maturity),
		};
		// CNCF projects first, so a project wins over a member entry sharing its URL.
		const items = [...data.items].sort((left, right) =>
			Number(!!right.maturity) - Number(!!left.maturity)
		);
		const index = (
			map: Map<string, Record<string, unknown>>,
			key: unknown,
			item: Record<string, unknown>,
		) => {
			if (
				typeof key === "string" && key !== "" && !map.has(comparableUrl(key))
			) {
				map.set(comparableUrl(key), item);
			}
		};
		for (const item of items) {
			for (
				const repository of (item.repositories ?? []) as Array<{ url?: string }>
			) {
				index(landscape.bySource, repository.url, item);
			}
			index(landscape.byWebsite, item.homepage_url, item);
			index(landscape.byName, item.name, item);
		}
		for (const [url, repository] of Object.entries(data.github_data ?? {})) {
			landscape.repositories[comparableUrl(url)] = repository;
		}
		return landscape;
	} catch {
		return null;
	}
}

function matchLandscape(
	technology: Technology,
	landscape: Landscape | null,
): Evidence["landscape"] {
	if (!landscape) return null;
	const { source, website, name, aliases } = technology.columns;
	const lookups: Array<
		[
			"source" | "website" | "name",
			Map<string, Record<string, unknown>>,
			unknown,
		]
	> = [
		["source", landscape.bySource, source],
		["website", landscape.byWebsite, website],
		["name", landscape.byName, name],
		...(Array.isArray(aliases) ? aliases : []).map((alias) =>
			["name", landscape.byName, alias] as [
				"name",
				Map<string, Record<string, unknown>>,
				unknown,
			]
		),
	];
	for (const [matchedBy, map, key] of lookups) {
		const item = typeof key === "string"
			? map.get(comparableUrl(key))
			: undefined;
		if (item) return { item, matchedBy };
	}
	return null;
}

async function fetchRepository(
	source: unknown,
	landscape: Landscape | null,
): Promise<RepositoryEvidence | null> {
	const repository = githubRepository(source);
	if (!repository) return null;
	const listed = landscape
		?.repositories[comparableUrl(`https://github.com/${repository}`)];
	const fallback: RepositoryEvidence = {
		state: "unavailable",
		license: LICENSE_IDENTIFIERS[String(listed?.license)] ?? null,
		description: (listed?.description as string | undefined) ?? null,
	};
	try {
		const token = Deno.env.get("GITHUB_TOKEN");
		const response = await request(
			`https://api.github.com/repos/${repository}`,
			{
				headers: {
					accept: "application/vnd.github+json",
					...(token ? { authorization: `Bearer ${token}` } : {}),
				},
			},
		);
		if (response.status === 404) {
			await response.body?.cancel();
			return { state: "missing" };
		}
		if (!response.ok) {
			await response.body?.cancel();
			return {
				...fallback,
				detail:
					`GitHub answered ${response.status}; set GITHUB_TOKEN to lift the rate limit`,
			};
		}
		const data = await response.json() as {
			html_url: string;
			archived: boolean;
			description: string | null;
			has_discussions?: boolean;
			license: { spdx_id?: string } | null;
		};
		const license = data.license?.spdx_id;
		return {
			state: "ok",
			url: data.html_url,
			archived: data.archived,
			description: data.description,
			discussions: data.has_discussions === true,
			license: license && license !== "NOASSERTION" ? license : null,
		};
	} catch (error) {
		return {
			...fallback,
			detail: error instanceof Error ? error.message : String(error),
		};
	}
}

async function logoExists(
	contentUrl: string,
	id: string,
	variant: string,
): Promise<boolean | null> {
	try {
		const response = await request(
			`${contentUrl}/technologies/${id}/${variant}.svg`,
			{ method: "HEAD" },
		);
		return response.status === 200
			? true
			: response.status === 404
			? false
			: null;
	} catch {
		return null;
	}
}

async function websiteDescription(website: unknown): Promise<string | null> {
	if (typeof website !== "string") return null;
	try {
		const response = await request(website);
		if (!response.ok) {
			await response.body?.cancel();
			return null;
		}
		const tag = (await response.text()).slice(0, 200_000)
			.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]*>/i)
			?.[0];
		return tag?.match(/content=["']([^"']+)["']/i)?.[1]?.trim() ?? null;
	} catch {
		return null;
	}
}

/**
 * Render Markdown to a rich-text document with the repository's own converter,
 * so `body` is exactly what every other writer produces.
 */
async function renderBody(
	repositoryDirectory: string,
	markdown: string,
): Promise<unknown> {
	const file = await Deno.makeTempFile({ suffix: ".md" });
	try {
		await Deno.writeTextFile(file, markdown);
		const script = 'import { fromMarkdown } from "./src/markdown/index.ts";' +
			'import { validateDoc } from "./src/schema.ts";' +
			"const file = process.argv[1];" +
			"const doc = fromMarkdown(await Bun.file(file).text(), { mdx: false, file });" +
			"validateDoc(doc); console.log(JSON.stringify(doc));";
		const output = await new Deno.Command("bun", {
			args: ["-e", script, file],
			cwd: `${repositoryDirectory}/packages/rich-text`,
			stdout: "piped",
			stderr: "piped",
		}).output();
		if (!output.success) {
			throw new Error(
				`Could not render the description: ${
					new TextDecoder().decode(output.stderr).trim()
				}`,
			);
		}
		return JSON.parse(new TextDecoder().decode(output.stdout));
	} finally {
		await Deno.remove(file);
	}
}

function describe(value: unknown): string {
	if (value === null || value === undefined) return "(unset)";
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}

/** Every technology id in the table, which the read step attaches to each row. */
function knownIdentifiers(rows: Array<Record<string, unknown>>): string[] {
	return typeof rows[0]?.known_ids === "string"
		? JSON.parse(rows[0].known_ids) as string[]
		: rows.map((row) => String(row.id));
}

const ChangesSchema = z.record(z.string(), z.record(z.string(), z.unknown()))
	.default({})
	.describe(
		"Values to write regardless of the findings: id, then field path, then value (null clears)",
	);

const RunSchema = z.string().default("")
	.describe(
		"Id of the workflow run, so its plan is kept apart from other runs' plans; empty when run by hand",
	);

/** The data name of a run's plan. */
function planName(run: string): string {
	return run === "" ? "plan" : `plan-${run}`;
}

function split(list: string): string[] {
	return list.split(",").map((entry) => entry.trim()).filter(Boolean);
}

/** Behavior definition for auditing and updating technology profiles. */
export const behavior = {
	type: "@rawkode/academy/technology",
	version: "2026.11.11.2",
	globalArguments: GlobalArgsSchema,
	resources: {
		audit: {
			description:
				"Field-by-field findings and planned changes for one technology",
			schema: AuditSchema,
			lifetime: "infinite" as const,
			garbageCollection: 10,
		},
		drafting: {
			description:
				"One copywriting request per technology whose search-result text is missing or weak",
			schema: DraftingSchema,
			lifetime: "infinite" as const,
			garbageCollection: 10,
		},
		plan: {
			description:
				"The statements a run wants written to D1, one plan per workflow run",
			schema: PlanSchema,
			lifetime: "90d" as const,
			garbageCollection: 5,
		},
		gaps: {
			description: "CNCF projects that have no technology profile",
			schema: GapsSchema,
			lifetime: "infinite" as const,
			garbageCollection: 10,
		},
		confirmation: {
			description: "Proof that the planned values are stored in D1",
			schema: ConfirmationSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
		invalidation: {
			description: "The website cache tags purged after a write",
			schema: InvalidationSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
	},
	methods: {
		audit: {
			description:
				"Check every field of the given technology rows against primary sources (HTTP, the repository host, the CNCF landscape, the content bucket) and search-result standards, and ask for a draft of any search-result text that falls short",
			arguments: z.object({
				rows: RowsSchema,
				technologies: z.string().default("")
					.describe(
						"Comma-separated ids that must be among the rows; empty accepts whatever was read",
					),
				changes: ChangesSchema,
			}),
			execute: async (
				args: {
					rows: Array<Record<string, unknown>>;
					technologies: string;
					changes: Record<string, Record<string, unknown>>;
				},
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const technologies = args.rows.map(parseRow);
				const identifiers = technologies.map((technology) => technology.id);
				const absent = [
					...split(args.technologies),
					...Object.keys(args.changes),
				]
					.filter((id) => !identifiers.includes(id));
				if (absent.length > 0) {
					throw new Error(
						`No technology row for: ${[...new Set(absent)].join(", ")}`,
					);
				}

				const landscape = await fetchLandscape();
				const urls = [...new Set(technologies.flatMap(linksToCheck))];
				context.logger.info("Auditing {count} technologies, {links} links", {
					count: technologies.length,
					links: urls.length,
				});
				const checks = await inParallel(urls, checkLink);
				const links = Object.fromEntries(
					urls.map((url, index) => [url, checks[index]]),
				);

				const audited = await inParallel(technologies, async (technology) => {
					const variants = ["icon", "horizontal", "stacked"];
					const [repository, description, ...logos] = await Promise.all([
						fetchRepository(technology.columns.source, landscape),
						websiteDescription(technology.columns.website),
						...variants.map((variant) =>
							logoExists(context.globalArgs.contentUrl, technology.id, variant)
						),
					]);
					const evidence: Evidence = {
						landscapeAvailable: landscape !== null,
						landscape: matchLandscape(technology, landscape),
						repository,
						links,
						logos: Object.fromEntries(
							variants.map((variant, index) => [variant, logos[index]]),
						),
						knownIdentifiers: knownIdentifiers(args.rows),
						websiteDescription: description,
					};
					const findings = evaluate(technology, evidence);
					// Text the caller supplies needs no draft.
					const supplied = args.changes[technology.id] ?? {};
					const prompt = seoPrompt(
						technology,
						findings.filter((finding) => !(finding.field in supplied)),
						evidence,
					);
					return { technology, findings, prompt };
				});

				const now = new Date().toISOString();
				const handles: Array<{ name: string }> = [];
				for (const { technology, findings } of audited) {
					const counts: Record<string, number> = {};
					for (const finding of findings) {
						counts[finding.status] = (counts[finding.status] ?? 0) + 1;
					}
					handles.push(
						await context.writeResource("audit", `audit-${technology.id}`, {
							id: technology.id,
							auditedAt: now,
							counts,
							findings,
							changes: [],
						}),
					);
				}
				const requests = audited.flatMap(({ technology, prompt }) =>
					prompt === null
						? []
						: [{ key: technology.id, prompt, jsonSchema: SEO_DRAFT_SCHEMA }]
				);
				handles.push(
					await context.writeResource("drafting", "seo-requests", {
						createdAt: now,
						systemPrompt: SEO_SYSTEM_PROMPT,
						requests,
					}),
				);
				context.logger.info(
					"Audited {count} technologies; {drafts} need search-result text drafted",
					{ count: audited.length, drafts: requests.length },
				);
				return { dataHandles: handles };
			},
		},
		plan: {
			description:
				"Turn the latest audit of the given rows into the D1 update: sourced findings, accepted findings, drafted search-result text that passes the checks, and the caller's own values",
			arguments: z.object({
				rows: RowsSchema,
				accept: z.string().default("")
					.describe(
						"Comma-separated findings whose observed value to apply: `field` or `id:field`",
					),
				changes: ChangesSchema,
				drafts: z.array(z.unknown()).default([])
					.describe(
						"The copywriter's answers, keyed by technology id: `cliResult` records of @keeb/anthropic/claude",
					),
				run: RunSchema,
			}),
			execute: async (
				args: {
					rows: Array<Record<string, unknown>>;
					accept: string;
					changes: Record<string, Record<string, unknown>>;
					drafts: unknown[];
					run: string;
				},
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const technologies = args.rows.map(parseRow);
				const known = knownIdentifiers(args.rows);
				const drafts = new Map(args.drafts.map((entry) => {
					const record = entry as Record<string, unknown>;
					const answer = (record.attributes ?? record) as Record<
						string,
						unknown
					>;
					return [String(answer.key), answer];
				}));

				const accept = split(args.accept);
				const accepted = new Set<string>();
				const planned = [];
				for (const technology of technologies) {
					const audit = await context.readResource!(
						`audit-${technology.id}`,
					) as { findings: Finding[] } | null;
					if (!audit) {
						throw new Error(`No audit of ${technology.id}: run audit first`);
					}
					const requested = args.changes[technology.id] ?? {};
					const fields = seoFieldsToDraft(audit.findings)
						.filter((field) => !(field in requested));
					const draft = drafts.get(technology.id);
					const review = fields.length === 0
						? { values: {}, rejected: [] }
						: draft?.ok === true
						? reviewDraft(technology, fields, draft.structured)
						: {
							values: {},
							rejected: [`not drafted: ${draft?.error ?? "no answer"}`],
						};
					// A sourced or drafted value that breaks the column's rules is left
					// out and reported; one the caller asked for fails the plan below.
					const dropped: string[] = [];
					const changes = planChanges(
						technology,
						audit.findings,
						accept,
						requested,
						accepted,
						review.values,
					).filter((change) => {
						if (
							change.field === "body" ||
							["accepted", "requested"].includes(change.reason)
						) return true;
						const problem = validateValue(change.field, change.to, known);
						if (problem !== null) dropped.push(problem);
						return problem === null;
					});
					planned.push({
						technology,
						findings: audit.findings,
						rejected: review.rejected,
						dropped,
						changes,
					});
				}

				const unused = accept.filter((entry) => !accepted.has(entry));
				if (unused.length > 0) {
					throw new Error(
						`Nothing to accept for: ${
							unused.join(", ")
						} (no finding with an observed value)`,
					);
				}
				const problems = planned.flatMap(({ technology, changes }) =>
					changes
						.filter((change) => change.field !== "body")
						.map((change) => validateValue(change.field, change.to, known))
						.filter((problem): problem is string => problem !== null)
						.map((problem) => `${technology.id}: ${problem}`)
				);
				if (problems.length > 0) {
					throw new Error(`Refusing the plan:\n${problems.join("\n")}`);
				}

				const statements: Statement[] = [];
				const expected: Plan["expected"] = {};
				const lines: string[] = [];
				let needsReview = 0;
				const now = new Date().toISOString();
				const handles: Array<{ name: string }> = [];
				for (
					const { technology, findings, changes, rejected, dropped } of planned
				) {
					const counts: Record<string, number> = {};
					for (const finding of findings) {
						counts[finding.status] = (counts[finding.status] ?? 0) + 1;
					}
					const open = findings.filter((finding: Finding) =>
						["redirected", "mismatch", "broken", "missing", "invalid"].includes(
							finding.status,
						) &&
						!changes.some((change: Change) => change.field === finding.field)
					);
					needsReview += open.length + dropped.length;

					if (changes.length > 0) {
						const description = changes.find((change) =>
							change.field === "description"
						)?.to ??
							technology.columns.description;
						const rendersBody = changes.some((change) =>
							["description", "body"].includes(change.field)
						);
						const columns = applyChanges(
							technology,
							changes,
							rendersBody
								? await renderBody(context.repoDir, String(description))
								: undefined,
						);
						statements.push(buildStatement(technology, columns));
						expected[technology.id] = columns;
						lines.push(`${technology.id}:`);
						for (const change of changes) {
							lines.push(
								`  ${change.field}: ${describe(change.from)} -> ${
									describe(change.to)
								} (${change.reason})`,
							);
						}
					}
					if (open.length > 0) {
						lines.push(`${technology.id} needs review:`);
						for (const finding of open) {
							lines.push(
								`  ${finding.field} [${finding.status}]: ${
									describe(finding.current)
								}` +
									(finding.observed !== undefined
										? `; observed ${describe(finding.observed)}`
										: "") +
									(finding.note ? ` (${finding.note})` : ""),
							);
						}
					}
					if (dropped.length > 0) {
						lines.push(`${technology.id} not written:`);
						lines.push(...dropped.map((problem) => `  ${problem}`));
					}
					if (rejected.length > 0) {
						lines.push(`${technology.id} drafts rejected:`);
						lines.push(...rejected.map((reason) => `  ${reason}`));
					}
					handles.push(
						await context.writeResource("audit", `audit-${technology.id}`, {
							id: technology.id,
							auditedAt: now,
							counts,
							findings,
							changes,
						}),
					);
				}

				// A rejected draft gets one more attempt, told what was wrong with it.
				const drafting = await context.readResource!("seo-requests") as
					| z.infer<typeof DraftingSchema>
					| null;
				const retries = planned.flatMap(({ technology, rejected }) => {
					const request = drafting?.requests.find((request) =>
						request.key === technology.id
					);
					return request && rejected.length > 0
						? [{
							...request,
							prompt:
								`${request.prompt}\n\nYour previous draft was rejected:\n${
									rejected.map((reason) => `- ${reason}`).join("\n")
								}\nWrite the title and description again.`,
						}]
						: [];
				});
				handles.push(
					await context.writeResource("drafting", "seo-retries", {
						createdAt: now,
						systemPrompt: drafting?.systemPrompt ?? SEO_SYSTEM_PROMPT,
						requests: retries,
					}),
				);
				for (const line of lines) context.logger.info("{line}", { line });

				handles.push(
					await context.writeResource("plan", planName(args.run), {
						createdAt: now,
						audited: planned.length,
						technologies: Object.keys(expected),
						statements,
						expected,
						needsReview,
						summary: lines.join("\n") ||
							"Every checked field is confirmed; nothing to write.",
					}),
				);
				context.logger.info(
					"Planned {changes} updates; {review} findings need review; {retries} drafts to retry",
					{
						changes: statements.length,
						review: needsReview,
						retries: retries.length,
					},
				);
				return { dataHandles: handles };
			},
		},
		discover: {
			description:
				"List the CNCF landscape projects that none of the given technology rows covers by repository, website, name or alias",
			arguments: z.object({
				rows: RowsSchema,
				maturity: z.string().default("graduated,incubating,sandbox")
					.describe("Comma-separated CNCF maturity levels to include"),
			}),
			execute: async (
				args: { rows: Array<Record<string, unknown>>; maturity: string },
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const landscape = await fetchLandscape();
				if (!landscape) {
					throw new Error("The CNCF landscape could not be fetched");
				}
				const maturity = split(args.maturity);
				const projects = landscape.projects.filter((project) =>
					maturity.includes(String(project.maturity))
				);
				const text = (value: unknown) =>
					typeof value === "string" && value !== "" ? value : null;
				const missing = uncovered(args.rows.map(parseRow), projects)
					.map((project) => {
						const repositories = (project.repositories ?? []) as Array<
							{ url?: string; primary?: boolean }
						>;
						return {
							name: String(project.name),
							maturity: String(project.maturity),
							accepted: text(project.accepted_at),
							category: text(project.category),
							subcategory: text(project.subcategory),
							website: text(project.homepage_url),
							source: text(
								(repositories.find((repository) => repository.primary) ??
									repositories[0])?.url,
							),
							description: text(project.description),
						};
					})
					.sort((left, right) =>
						maturity.indexOf(left.maturity) -
							maturity.indexOf(right.maturity) ||
						left.name.localeCompare(right.name)
					);
				for (const project of missing) {
					context.logger.info("{maturity}: {name} {source}", {
						maturity: project.maturity,
						name: project.name,
						source: project.source ?? project.website ?? "",
					});
				}
				context.logger.info(
					"{missing} of {projects} CNCF projects have no technology profile",
					{ missing: missing.length, projects: projects.length },
				);
				const handle = await context.writeResource("gaps", "landscape-gaps", {
					checkedAt: new Date().toISOString(),
					maturity,
					projects: projects.length,
					missing,
				});
				return { dataHandles: [handle] };
			},
		},
		confirm: {
			description:
				"Compare freshly read technology rows with the latest plan and fail unless every planned value is stored",
			arguments: z.object({ rows: RowsSchema, run: RunSchema }),
			execute: async (
				args: { rows: Array<Record<string, unknown>>; run: string },
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const plan = await context.readResource!(planName(args.run)) as
					| Plan
					| null;
				if (!plan) throw new Error("No plan to confirm: run plan first");
				const stored = new Map(
					args.rows.map(parseRow).map((
						technology,
					) => [technology.id, technology]),
				);
				const failures: string[] = [];
				let columns = 0;
				for (const [id, expected] of Object.entries(plan.expected)) {
					const technology = stored.get(id);
					for (const [column, value] of Object.entries(expected)) {
						columns++;
						if (!technology || !columnMatches(technology, column, value)) {
							failures.push(`${id}.${column}`);
						}
					}
				}
				if (failures.length > 0) {
					throw new Error(
						`Not stored as planned: ${
							failures.join(", ")
						}. A profile edited after the audit is skipped by design; run the workflow again.`,
					);
				}
				const handle = await context.writeResource(
					"confirmation",
					"confirmation",
					{
						confirmedAt: new Date().toISOString(),
						technologies: Object.keys(plan.expected),
						columns,
					},
				);
				return { dataHandles: [handle] };
			},
		},
		invalidate: {
			description:
				"Purge the website cache for every technology in the latest plan",
			arguments: z.object({
				token: z.string().meta({ sensitive: true })
					.describe(
						"Bearer token of the website's cache invalidation endpoint; wire it with vault.get",
					),
				run: RunSchema,
			}),
			execute: async (
				args: { token: string; run: string },
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const plan = await context.readResource!(planName(args.run)) as
					| Plan
					| null;
				if (!plan || plan.technologies.length === 0) {
					throw new Error("The latest plan changed nothing");
				}
				const tags = plan.technologies.map((id) => `technologies:${id}`);
				// The endpoint purges twice, about 50 seconds apart, before answering.
				const response = await fetch(
					`${context.globalArgs.websiteUrl}/api/cache/invalidate`,
					{
						method: "POST",
						headers: {
							authorization: `Bearer ${args.token}`,
							"content-type": "application/json",
						},
						body: JSON.stringify({ tags }),
						signal: AbortSignal.timeout(180_000),
					},
				);
				const text = await response.text();
				if (!response.ok) {
					throw new Error(
						`Cache invalidation answered ${response.status}: ${
							text.slice(0, 300)
						}`,
					);
				}
				const handle = await context.writeResource(
					"invalidation",
					"invalidation",
					{
						invalidatedAt: new Date().toISOString(),
						tags,
						status: response.status,
					},
				);
				return { dataHandles: [handle] };
			},
		},
	},
};
