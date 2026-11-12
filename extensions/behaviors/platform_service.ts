/**
 * Checks that every Rawkode Academy platform service
 * (`projects/rawkode.academy/platform/*`) is deployed as it declares. It reads
 * the generated Wrangler configurations, compares them with what the
 * `@webframp/cloudflare/*` behaviors list in the account, and asks the public
 * gateway whether each subgraph answers. It only reports: nothing is created,
 * changed or deleted.
 *
 * @module
 */
import { z } from "npm:zod@4";
import {
	compare,
	countDeclared,
	type DeclaredService,
	type DeclaredSubgraph,
	declaredWorker,
	gatewaySubgraphs,
	type IntrospectedField,
	liveQuery,
	parseJsonWithComments,
	rootFields,
} from "./_lib/platform_service.ts";
import { inParallel, request } from "./_lib/http.ts";

const CONFIGURATION_FILE = "wrangler.jsonc";
const SEARCH_DEPTH = 3;
const IGNORED_DIRECTORIES = ["node_modules", "dist", "build", "target"];

const GlobalArgsSchema = z.object({
	platformDirectory: z.string().default("projects/rawkode.academy/platform")
		.describe("Folder, relative to the repository, with one service each"),
	gatewayConfiguration: z.string()
		.default("projects/rawkode.academy/api/wrangler.jsonc")
		.describe("Wrangler configuration of the gateway, relative to the root"),
	gatewayUrl: z.string().url().default("https://api.rawkode.academy/")
		.describe("Public GraphQL endpoint of the gateway"),
	workersSubdomain: z.string().default("rawkodeacademy")
		.describe("The account's workers.dev subdomain"),
});
type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const DeclaredWorkerSchema = z.object({
	name: z.string(),
	configuration: z.string(),
	workersDevelopment: z.boolean(),
	databases: z.array(
		z.object({
			binding: z.string(),
			name: z.string(),
			identifier: z.string(),
		}),
	),
	queues: z.array(
		z.object({
			name: z.string(),
			role: z.enum(["producer", "consumer", "dead-letter"]),
		}),
	),
	serviceBindings: z.array(
		z.object({ binding: z.string(), worker: z.string() }),
	),
	buckets: z.array(z.object({ binding: z.string(), name: z.string() })),
	keyValueNamespaces: z.array(
		z.object({ binding: z.string(), identifier: z.string() }),
	),
	workflows: z.array(
		z.object({
			binding: z.string(),
			name: z.string(),
			className: z.string(),
		}),
	),
	secrets: z.array(
		z.object({ binding: z.string(), store: z.string(), name: z.string() }),
	),
	routes: z.array(z.string()),
	schedules: z.array(z.string()),
	otherBindings: z.array(z.string()),
});

const DeclaredServiceSchema = z.object({
	name: z.string(),
	directory: z.string(),
	workers: z.array(DeclaredWorkerSchema),
});

const SubgraphSchema = z.object({
	binding: z.string(),
	worker: z.string(),
	service: z.string().nullable(),
	workersDevelopment: z.boolean(),
});

const DeclaredSchema = z.object({
	collectedAt: z.string(),
	platformDirectory: z.string(),
	services: z.array(DeclaredServiceSchema),
	skipped: z.array(z.object({ directory: z.string(), reason: z.string() })),
	gateway: z.object({
		worker: z.string().nullable(),
		subgraphs: z.array(SubgraphSchema),
	}),
	counts: z.record(z.string(), z.number()),
});

const ProblemSchema = z.object({
	service: z.string(),
	worker: z.string(),
	kind: z.string(),
	subject: z.string(),
	expected: z.string().optional(),
	actual: z.string().optional(),
	detail: z.string(),
});

const VerdictSchema = z.object({
	comparedAt: z.string(),
	ok: z.boolean(),
	liveListingsTruncated: z.boolean(),
	live: z.record(z.string(), z.number()),
	services: z.array(
		z.object({
			name: z.string(),
			ok: z.boolean(),
			matches: z.array(z.string()),
			problems: z.array(ProblemSchema),
		}),
	),
	problems: z.array(ProblemSchema),
	counts: z.record(z.string(), z.number()),
	summary: z.string(),
});

const LivenessSchema = z.object({
	checkedAt: z.string(),
	ok: z.boolean(),
	gatewayUrl: z.string(),
	gateway: z.object({ ok: z.boolean(), detail: z.string() }),
	subgraphs: z.array(
		z.object({
			binding: z.string(),
			worker: z.string(),
			service: z.string().nullable(),
			ok: z.boolean(),
			workerAnswered: z.boolean().nullable(),
			rootFields: z.array(z.string()),
			missingFromGateway: z.array(z.string()),
			queried: z.string().nullable(),
			detail: z.string(),
		}),
	),
	failures: z.array(z.string()),
	summary: z.string(),
});

const LiveItemsSchema = z.array(z.record(z.string(), z.unknown()));

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

async function exists(path: string): Promise<boolean> {
	try {
		await Deno.stat(path);
		return true;
	} catch {
		return false;
	}
}

/** Every Wrangler configuration below a directory, as sorted relative paths. */
async function findConfigurations(
	directory: string,
	prefix = "",
	depth = 0,
): Promise<string[]> {
	const found: string[] = [];
	for await (const entry of Deno.readDir(directory)) {
		if (entry.isFile && entry.name === CONFIGURATION_FILE) {
			found.push(`${prefix}${entry.name}`);
		} else if (
			entry.isDirectory && depth < SEARCH_DEPTH &&
			!entry.name.startsWith(".") && !IGNORED_DIRECTORIES.includes(entry.name)
		) {
			found.push(
				...await findConfigurations(
					`${directory}/${entry.name}`,
					`${prefix}${entry.name}/`,
					depth + 1,
				),
			);
		}
	}
	return found.sort();
}

async function readConfiguration(path: string): Promise<unknown> {
	try {
		return parseJsonWithComments(await Deno.readTextFile(path));
	} catch (error) {
		throw new Error(
			`Could not read ${path}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

async function graphql(
	url: string,
	query: string,
): Promise<{ data?: Record<string, unknown>; problem?: string }> {
	try {
		const response = await request(url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ query }),
		});
		const body = await response.text();
		if (!response.ok) {
			return { problem: `answered ${response.status}: ${body.slice(0, 200)}` };
		}
		const answer = JSON.parse(body) as {
			data?: Record<string, unknown>;
			errors?: Array<{ message?: string }>;
		};
		if (answer.errors?.length) {
			return {
				problem: answer.errors.map((error) => error.message).join("; ")
					.slice(0, 300),
			};
		}
		return { data: answer.data ?? {} };
	} catch (error) {
		return { problem: error instanceof Error ? error.message : String(error) };
	}
}

const TYPE_REFERENCE =
	"kind ofType { kind ofType { kind ofType { kind ofType { kind ofType { kind } } } } }";

/** Behavior definition for verifying the platform services. */
export const behavior = {
	type: "@rawkode/academy/platform-service",
	version: "2026.11.11.1",
	globalArguments: GlobalArgsSchema,
	resources: {
		declared: {
			description:
				"What every platform service declares in its Wrangler configurations",
			schema: DeclaredSchema,
			lifetime: "infinite" as const,
			garbageCollection: 10,
		},
		verdict: {
			description:
				"Per service, what matches the account and what is missing or different",
			schema: VerdictSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
		liveness: {
			description: "Whether each subgraph answers on the public gateway",
			schema: LivenessSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
	},
	methods: {
		declared: {
			description:
				"Read every platform service's Wrangler configurations from the repository and record the workers, D1 databases, queues and other bindings they declare. Needs no credentials.",
			arguments: z.object({}),
			execute: async (
				_args: Record<string, never>,
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const { platformDirectory, gatewayConfiguration } = context.globalArgs;
				const root = `${context.repoDir}/${platformDirectory}`;
				const directories: string[] = [];
				try {
					for await (const entry of Deno.readDir(root)) {
						if (entry.isDirectory && !entry.name.startsWith(".")) {
							directories.push(entry.name);
						}
					}
				} catch {
					throw new Error(`No platform directory at ${root}`);
				}

				const services: DeclaredService[] = [];
				const skipped: Array<{ directory: string; reason: string }> = [];
				const ungenerated: string[] = [];
				for (const name of directories.sort()) {
					const directory = `${platformDirectory}/${name}`;
					const paths = await findConfigurations(`${root}/${name}`);
					if (paths.length === 0) {
						if (await exists(`${root}/${name}/service.cue`)) {
							ungenerated.push(name);
						} else {
							skipped.push({
								directory,
								reason: `no ${CONFIGURATION_FILE}: not a Cloudflare worker`,
							});
						}
						continue;
					}
					const workers = [];
					for (const path of paths) {
						const worker = declaredWorker(
							await readConfiguration(`${root}/${name}/${path}`),
							`${directory}/${path}`,
						);
						if (worker) {
							workers.push(worker);
						} else {
							skipped.push({
								directory: `${directory}/${path}`,
								reason: "the configuration names no worker",
							});
						}
					}
					if (workers.length > 0) services.push({ name, directory, workers });
				}

				const generate =
					"Generated configurations are not committed: run `cuenv sync -A` at the repository root, then run this again.";
				if (ungenerated.length > 0) {
					throw new Error(
						`No ${CONFIGURATION_FILE} for ${
							ungenerated.join(", ")
						}. ${generate}`,
					);
				}
				if (services.length === 0) {
					throw new Error(
						`No ${CONFIGURATION_FILE} found under ${root}. ${generate}`,
					);
				}

				const gatewayPath = `${context.repoDir}/${gatewayConfiguration}`;
				const gateway = await exists(gatewayPath)
					? declaredWorker(
						await readConfiguration(gatewayPath),
						gatewayConfiguration,
					)
					: null;

				const counts = countDeclared(services);
				const handle = await context.writeResource("declared", "declared", {
					collectedAt: new Date().toISOString(),
					platformDirectory,
					services,
					skipped,
					gateway: {
						worker: gateway?.name ?? null,
						subgraphs: gatewaySubgraphs(gateway, services),
					},
					counts,
				});
				context.logger.info(
					"{services} services declare {workers} workers, {databases} databases and {queues} queues",
					counts,
				);
				return { dataHandles: [handle] };
			},
		},
		compare: {
			description:
				"Compare what the services declare with the workers, D1 databases and queues listed from the Cloudflare account, and record per service what matches and what is missing or different",
			arguments: z.object({
				services: z.array(DeclaredServiceSchema)
					.describe("The `services` of the latest `declared` resource"),
				databases: LiveItemsSchema
					.describe("Items of @webframp/cloudflare/d1 list_databases"),
				queues: LiveItemsSchema
					.describe("Items of @webframp/cloudflare/queues list"),
				workers: LiveItemsSchema
					.describe(
						"Items of @webframp/cloudflare/workers-scripts list_workers",
					),
				truncated: z.boolean().default(false)
					.describe("Whether any of the three listings was cut short"),
			}),
			execute: async (
				args: {
					services: DeclaredService[];
					databases: Array<Record<string, unknown>>;
					queues: Array<Record<string, unknown>>;
					workers: Array<Record<string, unknown>>;
					truncated: boolean;
				},
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const verdict = compare(args.services, args);
				const handle = await context.writeResource("verdict", "verdict", {
					comparedAt: new Date().toISOString(),
					liveListingsTruncated: args.truncated,
					live: {
						databases: args.databases.length,
						queues: args.queues.length,
						workers: args.workers.length,
					},
					...verdict,
					summary: args.truncated && !verdict.ok
						? `${verdict.summary}\nA listing from the account was cut short, so something reported missing may exist.`
						: verdict.summary,
				});
				context.logger.info("{summary}", { summary: verdict.summary });
				return { dataHandles: [handle] };
			},
		},
		probe: {
			description:
				"Ask the public gateway, without credentials, whether it answers and whether it serves each subgraph: every root field the subgraph's worker publishes must be in the gateway's schema, and one of them is queried through the gateway",
			arguments: z.object({
				subgraphs: z.array(SubgraphSchema)
					.describe("`gateway.subgraphs` of the latest `declared` resource"),
			}),
			execute: async (
				args: { subgraphs: DeclaredSubgraph[] },
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const { gatewayUrl, workersSubdomain } = context.globalArgs;
				const alive = await graphql(gatewayUrl, "{ __typename }");
				const introspection = await graphql(
					gatewayUrl,
					`{ __schema { queryType { fields { name args { type { kind } defaultValue } type { ${TYPE_REFERENCE} } } } } }`,
				);
				const schema = introspection.data?.__schema as
					| { queryType?: { fields?: IntrospectedField[] } }
					| undefined;
				const gatewayFields = schema?.queryType?.fields ?? [];
				const gatewayOk = alive.data?.__typename === "Query" &&
					gatewayFields.length > 0;

				const subgraphs = await inParallel(args.subgraphs, async (subgraph) => {
					const result = {
						binding: subgraph.binding,
						worker: subgraph.worker,
						service: subgraph.service,
						ok: true,
						workerAnswered: null as boolean | null,
						rootFields: [] as string[],
						missingFromGateway: [] as string[],
						queried: null as string | null,
						detail: "",
					};
					if (subgraph.service === null || !subgraph.workersDevelopment) {
						result.detail =
							"not probed: no public workers.dev address is declared for this worker";
						return result;
					}
					const published = await graphql(
						`https://${subgraph.worker}.${workersSubdomain}.workers.dev/`,
						"{ _service { sdl } }",
					);
					const service = published.data?._service as
						| { sdl?: string }
						| undefined;
					if (typeof service?.sdl !== "string") {
						result.ok = false;
						result.workerAnswered = false;
						result.detail = `the worker did not publish its schema: ${
							published.problem ?? "no schema in the answer"
						}`;
						return result;
					}
					result.workerAnswered = true;
					result.rootFields = rootFields(service.sdl);
					result.missingFromGateway = result.rootFields.filter((field) =>
						!gatewayFields.some((known) => known.name === field)
					);
					if (!gatewayOk) {
						result.ok = false;
						result.detail = "the gateway did not answer";
						return result;
					}
					if (result.missingFromGateway.length > 0) {
						result.ok = false;
						result.detail = `the gateway does not serve ${
							result.missingFromGateway.join(", ")
						}`;
						return result;
					}
					const query = liveQuery(result.rootFields, gatewayFields);
					if (!query) {
						result.detail = result.rootFields.length === 0
							? "the subgraph has no root query fields; it only extends other types"
							: "every root field is in the gateway's schema; none can be queried without arguments";
						return result;
					}
					result.queried = query.field;
					const answer = await graphql(gatewayUrl, query.query);
					if (answer.problem) {
						result.ok = false;
						result.detail =
							`${query.field} failed through the gateway: ${answer.problem}`;
					} else {
						result.detail = `${query.field} answered through the gateway`;
					}
					return result;
				});

				const failures = [
					...(gatewayOk ? [] : [
						`gateway ${gatewayUrl}: ${
							alive.problem ?? introspection.problem ?? "unexpected answer"
						}`,
					]),
					...subgraphs.filter((subgraph) => !subgraph.ok)
						.map((subgraph) => `${subgraph.worker}: ${subgraph.detail}`),
				];
				const queried = subgraphs.filter((subgraph) => subgraph.queried).length;
				const answered =
					subgraphs.filter((subgraph) => subgraph.workerAnswered).length;
				const handle = await context.writeResource("liveness", "liveness", {
					checkedAt: new Date().toISOString(),
					ok: failures.length === 0,
					gatewayUrl,
					gateway: {
						ok: gatewayOk,
						detail: gatewayOk
							? `answers and serves ${gatewayFields.length} root query fields`
							: alive.problem ?? introspection.problem ?? "unexpected answer",
					},
					subgraphs,
					failures,
					summary: failures.length === 0
						? `The gateway answers; ${answered} of ${subgraphs.length} subgraph workers published their schema and ${queried} were queried through the gateway.`
						: failures.join("\n"),
				});
				context.logger.info("{failures} liveness failures", {
					failures: failures.length,
				});
				return { dataHandles: [handle] };
			},
		},
	},
};
