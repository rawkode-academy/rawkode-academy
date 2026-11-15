/**
 * Audits Rawkode Academy people (rows of the `people` table in the
 * `platform-people` D1 database, plus their `people_links` rows) against the
 * sites their social fields point at and plans the update. D1 itself is read
 * and written by the `@webframp/cloudflare/d1` behavior; this one decides what
 * to write.
 *
 * @module
 */
import { z } from "npm:zod@4";
import {
	type AccountEvidence,
	applyChanges,
	buildStatement,
	columnMatches,
	evaluate,
	evaluateLinks,
	extractHandle,
	type LinkFinding,
	linksToCheck,
	parseLink,
	parseRow,
	planChanges,
	validateValue,
} from "./_lib/person.ts";
import type {
	Change,
	Finding,
	LinkCheck,
	Statement,
} from "./_lib/technology.ts";
import { checkLink, inParallel, request } from "./_lib/http.ts";

const BLUESKY_RESOLVER =
	"https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle";

const GlobalArgsSchema = z.object({
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

const LinkFindingSchema = z.object({
	personId: z.string(),
	url: z.string(),
	name: z.string(),
	status: z.string(),
	observed: z.string().optional(),
	note: z.string().optional(),
});

const AuditSchema = z.object({
	id: z.string(),
	auditedAt: z.string(),
	counts: z.record(z.string(), z.number()),
	findings: z.array(FindingSchema),
	changes: z.array(ChangeSchema),
	links: z.array(LinkFindingSchema),
});

const PlanSchema = z.object({
	createdAt: z.string(),
	audited: z.number(),
	people: z.array(z.string()),
	statements: z.array(
		z.object({ sql: z.string(), params: z.array(z.string()) }),
	),
	expected: z.record(z.string(), z.record(z.string(), z.unknown())),
	needsReview: z.number(),
	orphanedLinks: z.array(LinkFindingSchema),
	summary: z.string(),
});
type Plan = z.infer<typeof PlanSchema>;

const ConfirmationSchema = z.object({
	confirmedAt: z.string(),
	people: z.array(z.string()),
	columns: z.number(),
});

const InvalidationSchema = z.object({
	invalidatedAt: z.string(),
	tags: z.array(z.string()),
	status: z.number(),
});

const RowsSchema = z.array(z.record(z.string(), z.unknown()))
	.describe("Rows of the people table as returned by D1");

interface Context {
	globalArgs: GlobalArgs;
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

const REVIEW_STATUSES = [
	"redirected",
	"mismatch",
	"broken",
	"missing",
	"invalid",
];

/** Whether a host has an address record; null when the resolver did not say. */
async function hostResolves(hostname: string): Promise<boolean | null> {
	let unknown = false;
	for (const recordType of ["A", "AAAA"] as const) {
		try {
			if ((await Deno.resolveDns(hostname, recordType)).length > 0) return true;
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) unknown = true;
		}
	}
	return unknown ? null : false;
}

/**
 * Check a URL. A request that fails without an HTTP answer is settled by
 * asking DNS: a personal domain that no longer resolves is dead, not flaky.
 */
async function checkUrl(url: string): Promise<LinkCheck> {
	const check = await checkLink(url);
	if (check.state !== "error" || check.status !== undefined) return check;
	return await hostResolves(new URL(url).hostname) === false
		? { state: "broken", detail: "domain does not resolve" }
		: check;
}

/** Ask GitHub's API about an account, falling back to its profile page. */
function githubLookup(): (handle: string) => Promise<AccountEvidence> {
	const token = Deno.env.get("GITHUB_TOKEN");
	// Unauthenticated calls are limited to 60 an hour: stop asking once refused.
	let refused: string | null = null;
	return async (handle) => {
		if (refused === null) {
			try {
				const response = await request(
					`https://api.github.com/users/${encodeURIComponent(handle)}`,
					{
						headers: {
							accept: "application/vnd.github+json",
							...(token ? { authorization: `Bearer ${token}` } : {}),
						},
					},
				);
				if (response.status === 404) {
					await response.body?.cancel();
					return { state: "missing", source: "GitHub API" };
				}
				if (response.ok) {
					const data = await response.json() as { login: string; type: string };
					return {
						state: "ok",
						handle: data.login,
						source: "GitHub API",
						detail: data.type === "User" ? undefined : `a GitHub ${data.type}`,
					};
				}
				await response.body?.cancel();
				refused = `GitHub API answered ${response.status}`;
			} catch (error) {
				refused = error instanceof Error ? error.message : String(error);
			}
		}
		const hint = `${refused}; set GITHUB_TOKEN to lift the rate limit`;
		const page = await checkLink(`https://github.com/${handle}`);
		switch (page.state) {
			case "ok":
				return { state: "ok", handle, source: "github.com" };
			case "redirected":
				return {
					state: "ok",
					handle: extractHandle("github", page.finalUrl ?? "") ?? handle,
					source: "github.com",
				};
			case "broken":
				return { state: "missing", source: "github.com" };
			default:
				return {
					state: "unavailable",
					detail: `${hint}; github.com answered ${
						page.status ?? page.detail ?? page.state
					}`,
				};
		}
	};
}

/** Resolve a Bluesky handle through the public AppView. */
async function blueskyLookup(handle: string): Promise<AccountEvidence> {
	const source = "Bluesky AppView";
	try {
		const response = await request(
			`${BLUESKY_RESOLVER}?handle=${encodeURIComponent(handle)}`,
		);
		const data = await response.json().catch(() => ({})) as {
			did?: string;
			message?: string;
		};
		if (response.ok && data.did) {
			return { state: "ok", handle, source, detail: data.did };
		}
		if (response.status === 400) {
			return {
				state: "missing",
				source,
				detail: data.message ?? "handle does not resolve",
			};
		}
		return {
			state: "unavailable",
			detail: `${source} answered ${response.status}`,
		};
	} catch (error) {
		return {
			state: "unavailable",
			detail: error instanceof Error ? error.message : String(error),
		};
	}
}

function describe(value: unknown): string {
	if (value === null || value === undefined) return "(unset)";
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function split(list: string): string[] {
	return list.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function describeLink(finding: LinkFinding): string {
	return `  link ${finding.url} [${finding.status}]` +
		(finding.observed ? `; observed ${finding.observed}` : "") +
		(finding.note ? ` (${finding.note})` : "");
}

/** Behavior definition for auditing and updating people. */
export const behavior = {
	type: "@rawkode/academy/person",
	version: "2026.11.11.1",
	globalArguments: GlobalArgsSchema,
	resources: {
		audit: {
			description:
				"Field-by-field findings, planned changes and link checks for one person",
			schema: AuditSchema,
			lifetime: "infinite" as const,
			garbageCollection: 10,
		},
		plan: {
			description: "The statements the latest audit wants written to D1",
			schema: PlanSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
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
				"Check the social fields, names and extra links of the given people against the sites they point at (GitHub, Bluesky, HTTP) and plan the D1 update of the people table; links are reported, never written",
			arguments: z.object({
				rows: RowsSchema,
				links: z.array(z.record(z.string(), z.unknown())).default([])
					.describe("Rows of the people_links table as returned by D1"),
				people: z.string().default("")
					.describe(
						"Comma-separated ids that must be among the rows; empty accepts whatever was read",
					),
				accept: z.string().default("")
					.describe(
						"Comma-separated findings whose observed value to apply: `field` or `id:field`",
					),
				changes: z.record(z.string(), z.record(z.string(), z.unknown()))
					.default({})
					.describe(
						"Values to write regardless of the findings: id, then column, then value (null clears)",
					),
			}),
			execute: async (
				args: {
					rows: Array<Record<string, unknown>>;
					links: Array<Record<string, unknown>>;
					people: string;
					accept: string;
					changes: Record<string, Record<string, unknown>>;
				},
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const people = args.rows.map(parseRow);
				const identifiers = people.map((person) => person.id);
				const absent = [...split(args.people), ...Object.keys(args.changes)]
					.filter((id) => !identifiers.includes(id));
				if (absent.length > 0) {
					throw new Error(
						`No people row for: ${[...new Set(absent)].join(", ")}`,
					);
				}
				const knownIdentifiers = typeof args.rows[0]?.known_ids === "string"
					? JSON.parse(args.rows[0].known_ids) as string[]
					: identifiers;
				const links = args.links.map(parseLink);

				const urls = [
					...new Set([
						...people.flatMap(linksToCheck),
						...links.map((link) => link.url).filter((url) =>
							URL.canParse(url) && /^https?:$/.test(new URL(url).protocol)
						),
					]),
				];
				context.logger.info(
					"Auditing {count} people, {links} extra links, {urls} URLs",
					{ count: people.length, links: links.length, urls: urls.length },
				);
				const checks = await inParallel(urls, checkUrl);
				const linkChecks = Object.fromEntries(
					urls.map((url, index) => [url, checks[index]]),
				);
				const linkFindings = evaluateLinks(links, linkChecks, knownIdentifiers);

				const github = githubLookup();
				const accept = split(args.accept);
				const accepted = new Set<string>();
				const audited = await inParallel(people, async (person) => {
					// Only a well-formed handle is worth a request; evaluate reports the rest.
					const handle = (column: string) => {
						const value = person.columns[column];
						return value !== null && extractHandle(column, value) === value
							? value
							: null;
					};
					const githubHandle = handle("github");
					const blueskyHandle = handle("bluesky");
					const [githubAccount, blueskyAccount] = await Promise.all([
						githubHandle ? github(githubHandle) : null,
						blueskyHandle ? blueskyLookup(blueskyHandle) : null,
					]);
					const findings = evaluate(person, {
						github: githubAccount,
						bluesky: blueskyAccount,
						links: linkChecks,
					});
					const changes = planChanges(
						person,
						findings,
						accept,
						args.changes[person.id] ?? {},
						accepted,
					);
					return { person, findings, changes };
				});

				const unused = accept.filter((entry) => !accepted.has(entry));
				if (unused.length > 0) {
					throw new Error(
						`Nothing to accept for: ${
							unused.join(", ")
						} (no finding with an observed value)`,
					);
				}
				const problems = audited.flatMap(({ person, changes }) =>
					changes
						.map((change) => validateValue(change.field, change.to))
						.filter((problem): problem is string => problem !== null)
						.map((problem) => `${person.id}: ${problem}`)
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
				for (const { person, findings, changes } of audited) {
					const counts: Record<string, number> = {};
					for (const finding of findings) {
						counts[finding.status] = (counts[finding.status] ?? 0) + 1;
					}
					const open = findings.filter((finding: Finding) =>
						REVIEW_STATUSES.includes(finding.status) &&
						!changes.some((change: Change) => change.field === finding.field)
					);
					const ownLinks = linkFindings.filter((finding) =>
						finding.personId === person.id
					);
					const openLinks = ownLinks.filter((finding) =>
						REVIEW_STATUSES.includes(finding.status)
					);
					needsReview += open.length + openLinks.length;

					if (changes.length > 0) {
						const columns = applyChanges(changes);
						statements.push(buildStatement(person, columns));
						expected[person.id] = columns;
						lines.push(`${person.id}:`);
						for (const change of changes) {
							lines.push(
								`  ${change.field}: ${describe(change.from)} -> ${
									describe(change.to)
								} (${change.reason})`,
							);
						}
					}
					if (open.length + openLinks.length > 0) {
						lines.push(`${person.id} needs review:`);
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
						lines.push(...openLinks.map(describeLink));
					}
					handles.push(
						await context.writeResource("audit", `audit-${person.id}`, {
							id: person.id,
							auditedAt: now,
							counts,
							findings,
							changes,
							links: ownLinks,
						}),
					);
				}

				// Links whose owner was not among the audited rows: nothing to attach them to.
				const orphanedLinks = linkFindings.filter((finding) =>
					!identifiers.includes(finding.personId) &&
					REVIEW_STATUSES.includes(finding.status)
				);
				needsReview += orphanedLinks.length;
				for (const finding of orphanedLinks) {
					lines.push(
						`${finding.personId} (not an audited person) needs review:`,
						describeLink(finding),
					);
				}

				handles.push(
					await context.writeResource("plan", "plan", {
						createdAt: now,
						audited: audited.length,
						people: Object.keys(expected),
						statements,
						expected,
						needsReview,
						orphanedLinks,
						summary: lines.join("\n") ||
							"Every checked field is confirmed; nothing to write.",
					}),
				);
				context.logger.info(
					"Planned {changes} updates; {review} findings need review",
					{ changes: statements.length, review: needsReview },
				);
				return { dataHandles: handles };
			},
		},
		confirm: {
			description:
				"Compare freshly read people rows with the latest plan and fail unless every planned value is stored",
			arguments: z.object({ rows: RowsSchema }),
			execute: async (
				args: { rows: Array<Record<string, unknown>> },
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const plan = await context.readResource!("plan") as Plan | null;
				if (!plan) throw new Error("No plan to confirm: run audit first");
				const stored = new Map(
					args.rows.map(parseRow).map((person) => [person.id, person]),
				);
				const failures: string[] = [];
				let columns = 0;
				for (const [id, expected] of Object.entries(plan.expected)) {
					const person = stored.get(id);
					for (const [column, value] of Object.entries(expected)) {
						columns++;
						if (!person || !columnMatches(person, column, value)) {
							failures.push(`${id}.${column}`);
						}
					}
				}
				if (failures.length > 0) {
					throw new Error(
						`Not stored as planned: ${
							failures.join(", ")
						}. A person edited after the audit is skipped by design; run the workflow again.`,
					);
				}
				const handle = await context.writeResource(
					"confirmation",
					"confirmation",
					{
						confirmedAt: new Date().toISOString(),
						people: Object.keys(plan.expected),
						columns,
					},
				);
				return { dataHandles: [handle] };
			},
		},
		invalidate: {
			description:
				"Purge the website cache for every person in the latest plan",
			arguments: z.object({
				token: z.string().meta({ sensitive: true })
					.describe(
						"Bearer token of the website's cache invalidation endpoint; wire it with vault.get",
					),
			}),
			execute: async (
				args: { token: string },
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const plan = await context.readResource!("plan") as Plan | null;
				if (!plan || plan.people.length === 0) {
					throw new Error("The latest plan changed nothing");
				}
				const tags = plan.people.map((id) => `people:${id}`);
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
