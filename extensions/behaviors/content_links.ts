/**
 * Sweeps the outbound links of Rawkode Academy content (articles from the
 * repository's content/articles files, everything else from the public
 * GraphQL gateway) and records the dead and redirected ones with where each
 * appears. It only reads: one GET per gateway content type, one per unique URL.
 *
 * @module
 */
import { z } from "npm:zod@4";
import {
	collectTargets,
	CONTENT_TYPES,
	type ContentItem,
	fileId,
	parseContentTypes,
	spreadByHost,
	summarise,
} from "./_lib/content_links.ts";
import type { LinkCheck } from "./_lib/technology.ts";
import { checkLink, inParallel, request } from "./_lib/http.ts";

const GlobalArgsSchema = z.object({
	gatewayUrl: z.string().url().default("https://api.rawkode.academy/")
		.describe("Public GraphQL gateway that serves the content"),
	websiteUrl: z.string().url().default("https://rawkode.academy")
		.describe(
			"Website the content is published on; its own links are internal",
		),
});
type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const SummarySchema = z.object({
	auditedAt: z.string(),
	contentTypes: z.array(z.string()),
	maximumItems: z.number(),
	includeInternal: z.boolean(),
	items: z.number(),
	itemsWithLinks: z.number(),
	links: z.number(),
	uniqueUrls: z.number(),
	checked: z.number(),
	internalSkipped: z.number(),
	notLinks: z.number(),
	ok: z.number(),
	redirected: z.number(),
	broken: z.number(),
	blocked: z.number(),
	error: z.number(),
	byContentType: z.record(
		z.string(),
		z.object({
			items: z.number(),
			links: z.number(),
			broken: z.number(),
			redirected: z.number(),
		}),
	),
});

const FindingsSchema = z.object({
	auditedAt: z.string(),
	links: z.array(z.object({
		url: z.string(),
		state: z.enum(["redirected", "broken", "blocked", "error"]),
		status: z.number().optional(),
		finalUrl: z.string().optional(),
		detail: z.string().optional(),
		internal: z.boolean(),
		locations: z.array(z.object({
			contentType: z.string(),
			id: z.string(),
			title: z.string(),
			field: z.string(),
		})),
	})),
});

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
}

/** Every Markdown/MDX file under a directory, as `{ id, source }` rows. */
async function readFiles(
	root: string,
	prefix = "",
): Promise<Array<Record<string, unknown>>> {
	const entries: Deno.DirEntry[] = [];
	for await (const entry of Deno.readDir(`${root}/${prefix}`)) {
		entries.push(entry);
	}
	entries.sort((a, b) => a.name.localeCompare(b.name));
	const rows: Array<Record<string, unknown>> = [];
	for (const entry of entries) {
		const path = `${prefix}${entry.name}`;
		if (entry.isDirectory) {
			rows.push(...await readFiles(root, `${path}/`));
		} else if (/\.mdx?$/.test(entry.name)) {
			rows.push({
				id: fileId(path),
				source: await Deno.readTextFile(`${root}/${path}`),
			});
		}
	}
	return rows;
}

async function readContent(
	repoDir: string,
	gatewayUrl: string,
	contentType: string,
	maximumItems: number,
): Promise<ContentItem[]> {
	const { selection, directory, collect } = CONTENT_TYPES[contentType];
	if (directory) {
		const files = await readFiles(`${repoDir}/${directory}`);
		return collect(maximumItems > 0 ? files.slice(0, maximumItems) : files);
	}
	const url = new URL(gatewayUrl);
	url.searchParams.set("query", `{ rows: ${selection} }`);
	const response = await request(url.href, {
		headers: { accept: "application/json" },
	});
	const answer = await response.json() as {
		data?: { rows?: Array<Record<string, unknown>> | null };
		errors?: Array<{ message: string }>;
	};
	if (!response.ok || !answer.data?.rows) {
		throw new Error(
			`The gateway could not read ${contentType} (${response.status}): ${
				answer.errors?.map((error) => error.message).join("; ") ?? "no data"
			}`,
		);
	}
	const rows = answer.data.rows;
	return collect(maximumItems > 0 ? rows.slice(0, maximumItems) : rows);
}

/** Behavior definition for auditing the links in published content. */
export const behavior = {
	type: "@rawkode/academy/content-links",
	version: "2026.11.12.1",
	globalArguments: GlobalArgsSchema,
	reports: ["@rawkode/academy/content-links"],
	resources: {
		summary: {
			description: "Totals for the latest link audit",
			schema: SummarySchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
		findings: {
			description:
				"Every broken, redirected, blocked or unreachable link with the content it appears in",
			schema: FindingsSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
	},
	methods: {
		audit: {
			description:
				"Read the content (articles from the repository, the rest from the gateway), collect and de-duplicate its links, request each one once and record the dead and redirected ones",
			arguments: z.object({
				contentTypes: z.string().default("")
					.describe(
						`Comma-separated content types to audit (${
							Object.keys(CONTENT_TYPES).join(", ")
						}); empty audits articles, news, courses, learning-paths and technologies`,
					),
				maximumItems: z.number().int().min(0).default(0)
					.describe(
						"Audit at most this many items of each content type; 0 audits all",
					),
				includeInternal: z.boolean().default(false)
					.describe("Also request links that point at the website itself"),
			}),
			execute: async (
				args: {
					contentTypes: string;
					maximumItems: number;
					includeInternal: boolean;
				},
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const contentTypes = parseContentTypes(args.contentTypes);
				const { gatewayUrl, websiteUrl } = context.globalArgs;
				const items: ContentItem[] = [];
				for (const contentType of contentTypes) {
					items.push(
						...await readContent(
							context.repoDir,
							gatewayUrl,
							contentType,
							args.maximumItems,
						),
					);
				}

				const { targets, notLinks } = collectTargets(items, websiteUrl);
				const toCheck = spreadByHost(
					targets.filter((target) => args.includeInternal || !target.internal),
				);
				context.logger.info(
					"Checking {links} unique links from {items} items",
					{ links: toCheck.length, items: items.length },
				);
				const results = await inParallel(
					toCheck,
					(target) => checkLink(target.url),
				);
				const checks = new Map<string, LinkCheck>(
					toCheck.map((target, index) => [target.url, results[index]]),
				);

				const auditedAt = new Date().toISOString();
				const { summary, findings } = summarise(
					{
						auditedAt,
						contentTypes,
						maximumItems: args.maximumItems,
						includeInternal: args.includeInternal,
						notLinks,
					},
					items,
					targets,
					checks,
				);
				context.logger.info(
					"{broken} broken, {redirected} redirected, {blocked} blocked, {error} unreachable",
					{ ...summary },
				);
				return {
					dataHandles: [
						await context.writeResource("summary", "summary", { ...summary }),
						await context.writeResource("findings", "findings", {
							auditedAt,
							links: findings,
						}),
					],
				};
			},
		},
	},
};
