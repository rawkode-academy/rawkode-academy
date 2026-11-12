/**
 * Pure rules for checking that the Rawkode Academy platform services are
 * deployed as declared: reading what a Wrangler configuration declares,
 * comparing it with what the Cloudflare account holds, and choosing the
 * public requests that prove a subgraph answers. Nothing here performs I/O:
 * the behavior reads the files and the network and hands the results in.
 *
 * @module
 */

/** A D1 database a worker binds. */
export interface DeclaredDatabase {
	binding: string;
	name: string;
	identifier: string;
}

/** A queue a worker produces to, consumes from or dead-letters into. */
export interface DeclaredQueue {
	name: string;
	role: "producer" | "consumer" | "dead-letter";
}

/** Another worker this worker calls through a service binding. */
export interface DeclaredServiceBinding {
	binding: string;
	worker: string;
}

/** Everything one Wrangler configuration declares. */
export interface DeclaredWorker {
	name: string;
	configuration: string;
	workersDevelopment: boolean;
	databases: DeclaredDatabase[];
	queues: DeclaredQueue[];
	serviceBindings: DeclaredServiceBinding[];
	buckets: Array<{ binding: string; name: string }>;
	keyValueNamespaces: Array<{ binding: string; identifier: string }>;
	workflows: Array<{ binding: string; name: string; className: string }>;
	secrets: Array<{ binding: string; store: string; name: string }>;
	routes: string[];
	schedules: string[];
	otherBindings: string[];
}

/** A directory under the platform folder and the workers it deploys. */
export interface DeclaredService {
	name: string;
	directory: string;
	workers: DeclaredWorker[];
}

/** A worker the public gateway routes a subgraph to. */
export interface DeclaredSubgraph {
	binding: string;
	worker: string;
	service: string | null;
	workersDevelopment: boolean;
}

/** What the Cloudflare account actually holds. */
export interface Live {
	databases: Array<Record<string, unknown>>;
	queues: Array<Record<string, unknown>>;
	workers: Array<Record<string, unknown>>;
}

/** The kinds of difference between declared and live. */
export type ProblemKind =
	| "worker-missing"
	| "database-missing"
	| "database-identifier-mismatch"
	| "database-name-mismatch"
	| "queue-missing"
	| "service-binding-target-missing";

/** One declared thing that is missing or different in the account. */
export interface Problem {
	service: string;
	worker: string;
	kind: ProblemKind;
	subject: string;
	expected?: string;
	actual?: string;
	detail: string;
}

/** The outcome for one service. */
export interface ServiceVerdict {
	name: string;
	ok: boolean;
	matches: string[];
	problems: Problem[];
}

/** The outcome for every service. */
export interface Verdict {
	ok: boolean;
	services: ServiceVerdict[];
	problems: Problem[];
	counts: {
		services: number;
		servicesWithProblems: number;
		matches: number;
		problems: number;
	};
	summary: string;
}

/** Bindings that are declared but have nothing in the account to list. */
const OTHER_BINDINGS = [
	"ai",
	"assets",
	"browser",
	"send_email",
	"durable_objects",
	"analytics_engine_datasets",
	"vectorize",
	"hyperdrive",
];

/**
 * Parse JSON that may hold line comments, block comments and trailing commas,
 * which is what Wrangler accepts in `wrangler.jsonc`.
 */
export function parseJsonWithComments(text: string): unknown {
	let output = "";
	let index = 0;
	while (index < text.length) {
		const character = text[index];
		const next = text[index + 1];
		if (character === '"') {
			const start = index++;
			while (index < text.length && text[index] !== '"') {
				index += text[index] === "\\" ? 2 : 1;
			}
			output += text.slice(start, ++index);
		} else if (character === "/" && next === "/") {
			while (index < text.length && text[index] !== "\n") index++;
		} else if (character === "/" && next === "*") {
			const end = text.indexOf("*/", index + 2);
			index = end === -1 ? text.length : end + 2;
		} else if (character === ",") {
			// A comma is dropped when only whitespace and comments precede the closer.
			const rest = text.slice(index + 1)
				.replace(/^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/, "");
			if (rest[0] !== "}" && rest[0] !== "]") output += character;
			index++;
		} else {
			output += character;
			index++;
		}
	}
	return JSON.parse(output);
}

function records(value: unknown): Array<Record<string, unknown>> {
	return Array.isArray(value)
		? value.filter((entry): entry is Record<string, unknown> =>
			typeof entry === "object" && entry !== null && !Array.isArray(entry)
		)
		: [];
}

function text(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/**
 * Read what one Wrangler configuration declares. Returns null when the
 * configuration names no worker, so it cannot be checked against the account.
 */
export function declaredWorker(
	configuration: unknown,
	path: string,
): DeclaredWorker | null {
	if (
		typeof configuration !== "object" || configuration === null ||
		Array.isArray(configuration)
	) {
		return null;
	}
	const config = configuration as Record<string, unknown>;
	const name = text(config.name);
	if (name === "") return null;

	const queueSection = (config.queues ?? {}) as Record<string, unknown>;
	const queues: DeclaredQueue[] = [];
	const addQueue = (queue: unknown, role: DeclaredQueue["role"]) => {
		const queueName = text(queue);
		if (
			queueName !== "" &&
			!queues.some((known) => known.name === queueName && known.role === role)
		) {
			queues.push({ name: queueName, role });
		}
	};
	for (const producer of records(queueSection.producers)) {
		addQueue(producer.queue, "producer");
	}
	for (const consumer of records(queueSection.consumers)) {
		addQueue(consumer.queue, "consumer");
		addQueue(consumer.dead_letter_queue, "dead-letter");
	}

	const triggers = (config.triggers ?? {}) as Record<string, unknown>;
	return {
		name,
		configuration: path,
		workersDevelopment: config.workers_dev !== false,
		databases: records(config.d1_databases).map((database) => ({
			binding: text(database.binding),
			name: text(database.database_name),
			identifier: text(database.database_id),
		})),
		queues,
		serviceBindings: records(config.services).map((service) => ({
			binding: text(service.binding),
			worker: text(service.service),
		})),
		buckets: records(config.r2_buckets).map((bucket) => ({
			binding: text(bucket.binding),
			name: text(bucket.bucket_name),
		})),
		keyValueNamespaces: records(config.kv_namespaces).map((namespace) => ({
			binding: text(namespace.binding),
			identifier: text(namespace.id),
		})),
		workflows: records(config.workflows).map((workflow) => ({
			binding: text(workflow.binding),
			name: text(workflow.name),
			className: text(workflow.class_name),
		})),
		secrets: records(config.secrets_store_secrets).map((secret) => ({
			binding: text(secret.binding),
			store: text(secret.store_id),
			name: text(secret.secret_name),
		})),
		routes: (Array.isArray(config.routes) ? config.routes : [])
			.map((route) =>
				typeof route === "string"
					? route
					: text((route as Record<string, unknown>)?.pattern)
			)
			.filter((route) => route !== ""),
		schedules: (Array.isArray(triggers.crons) ? triggers.crons : [])
			.filter((cron): cron is string => typeof cron === "string"),
		otherBindings: OTHER_BINDINGS.filter((key) => config[key] !== undefined),
	};
}

/**
 * The workers the gateway routes to, each tied back to the platform service
 * that declares it (null when the worker lives outside the platform folder).
 */
export function gatewaySubgraphs(
	gateway: DeclaredWorker | null,
	services: DeclaredService[],
): DeclaredSubgraph[] {
	return (gateway?.serviceBindings ?? []).map(({ binding, worker }) => {
		const service = services.find((candidate) =>
			candidate.workers.some((declared) => declared.name === worker)
		);
		const declared = service?.workers.find((candidate) =>
			candidate.name === worker
		);
		return {
			binding,
			worker,
			service: service?.name ?? null,
			workersDevelopment: declared?.workersDevelopment ?? false,
		};
	});
}

/** Count what the services declare, each distinct thing once. */
export function countDeclared(
	services: DeclaredService[],
): Record<string, number> {
	const workers = services.flatMap((service) => service.workers);
	const distinct = (values: string[]) => new Set(values).size;
	return {
		services: services.length,
		workers: distinct(workers.map((worker) => worker.name)),
		databases: distinct(
			workers.flatMap((worker) =>
				worker.databases.map((database) => database.identifier)
			),
		),
		queues: distinct(
			workers.flatMap((worker) => worker.queues.map((queue) => queue.name)),
		),
		serviceBindingTargets: distinct(
			workers.flatMap((worker) =>
				worker.serviceBindings.map((binding) => binding.worker)
			),
		),
		buckets: distinct(
			workers.flatMap((worker) => worker.buckets.map((bucket) => bucket.name)),
		),
		workflows: distinct(
			workers.flatMap((worker) =>
				worker.workflows.map((workflow) => workflow.name)
			),
		),
	};
}

/** Compare what every service declares with what the account holds. */
export function compare(services: DeclaredService[], live: Live): Verdict {
	const liveWorkers = new Set(live.workers.map((worker) => text(worker.id)));
	const liveQueues = new Set(
		live.queues.map((queue) => text(queue.queue_name)),
	);
	const databaseNames = new Map<string, string>();
	const databaseIdentifiers = new Map<string, string>();
	for (const database of live.databases) {
		databaseNames.set(text(database.uuid), text(database.name));
		databaseIdentifiers.set(text(database.name), text(database.uuid));
	}

	const verdicts = services.map((service): ServiceVerdict => {
		const matches: string[] = [];
		const problems: Problem[] = [];
		const report = (
			worker: string,
			kind: ProblemKind,
			subject: string,
			detail: string,
			expected?: string,
			actual?: string,
		) => {
			const duplicate = problems.some((problem) =>
				problem.kind === kind && problem.subject === subject &&
				problem.worker === worker
			);
			if (!duplicate) {
				problems.push({
					service: service.name,
					worker,
					kind,
					subject,
					...(expected === undefined ? {} : { expected }),
					...(actual === undefined ? {} : { actual }),
					detail,
				});
			}
		};
		const match = (line: string) => {
			if (!matches.includes(line)) matches.push(line);
		};

		for (const worker of service.workers) {
			if (liveWorkers.has(worker.name)) {
				match(`worker ${worker.name}`);
			} else {
				report(
					worker.name,
					"worker-missing",
					worker.name,
					`Worker ${worker.name} (${worker.configuration}) is not deployed`,
				);
			}

			for (const database of worker.databases) {
				const liveName = databaseNames.get(database.identifier);
				const liveIdentifier = databaseIdentifiers.get(database.name);
				if (liveName === database.name) {
					match(`database ${database.name} (${database.identifier})`);
				} else if (liveName !== undefined) {
					report(
						worker.name,
						"database-name-mismatch",
						database.name,
						`Database ${database.identifier} exists but is named ${liveName}, not ${database.name}`,
						database.name,
						liveName,
					);
				} else if (liveIdentifier !== undefined) {
					report(
						worker.name,
						"database-identifier-mismatch",
						database.name,
						`Database ${database.name} exists with id ${liveIdentifier}, not the declared ${database.identifier}`,
						database.identifier,
						liveIdentifier,
					);
				} else {
					report(
						worker.name,
						"database-missing",
						database.name,
						`Database ${database.name} (${database.identifier}) does not exist`,
						database.identifier,
					);
				}
			}

			for (const queue of worker.queues) {
				if (liveQueues.has(queue.name)) {
					match(`queue ${queue.name}`);
				} else {
					report(
						worker.name,
						"queue-missing",
						queue.name,
						`Queue ${queue.name} (${queue.role} of ${worker.name}) does not exist`,
					);
				}
			}

			for (const binding of worker.serviceBindings) {
				if (liveWorkers.has(binding.worker)) {
					match(`service binding target ${binding.worker}`);
				} else {
					report(
						worker.name,
						"service-binding-target-missing",
						binding.worker,
						`Worker ${binding.worker}, bound as ${binding.binding} by ${worker.name}, is not deployed`,
					);
				}
			}
		}
		return {
			name: service.name,
			ok: problems.length === 0,
			matches,
			problems,
		};
	});

	const problems = verdicts.flatMap((verdict) => verdict.problems);
	const failing = verdicts.filter((verdict) => !verdict.ok);
	const matches = verdicts.reduce(
		(total, verdict) => total + verdict.matches.length,
		0,
	);
	return {
		ok: problems.length === 0,
		services: verdicts,
		problems,
		counts: {
			services: verdicts.length,
			servicesWithProblems: failing.length,
			matches,
			problems: problems.length,
		},
		summary: problems.length === 0
			? `All ${verdicts.length} services are deployed as declared (${matches} checks).`
			: [
				`${failing.length} of ${verdicts.length} services differ from what they declare:`,
				...failing.flatMap((verdict) => [
					`${verdict.name}:`,
					...verdict.problems.map((problem) =>
						`  [${problem.kind}] ${problem.detail}`
					),
				]),
			].join("\n"),
	};
}

/**
 * The names of the root fields of one operation type in a subgraph's schema,
 * leaving out the fields federation adds to every subgraph.
 */
export function rootFields(
	schema: string,
	type: "Query" | "Mutation" = "Query",
): string[] {
	const source = schema
		.replace(/"""[\s\S]*?"""/g, "")
		.replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
		.replace(/#[^\n]*/g, "");
	const fields: string[] = [];
	const opening = new RegExp(`\\btype\\s+${type}\\b[^{}]*\\{`, "g");
	for (const match of source.matchAll(opening)) {
		let depth = 0;
		let index = match.index + match[0].length;
		let body = "";
		for (; index < source.length; index++) {
			const character = source[index];
			if (character === "}" && depth === 0) break;
			if (character === "(" || character === "{" || character === "[") depth++;
			if (character === ")" || character === "}" || character === "]") depth--;
			// Arguments are blanked so only field names are followed by a colon.
			body += depth === 0 && character !== ")" ? character : " ";
		}
		for (const field of body.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) {
			if (!field[1].startsWith("_") && !fields.includes(field[1])) {
				fields.push(field[1]);
			}
		}
	}
	return fields;
}

/** A root field as the gateway's introspection describes it. */
export interface IntrospectedField {
	name: string;
	args: Array<{
		type: { kind: string };
		defaultValue: string | null;
	}>;
	type: IntrospectedType;
}

interface IntrospectedType {
	kind: string;
	ofType?: IntrospectedType | null;
}

/**
 * A query that asks the gateway for one of the given root fields, choosing
 * the first that needs no arguments. Null when every field needs one.
 */
export function liveQuery(
	fields: string[],
	gateway: IntrospectedField[],
): { field: string; query: string } | null {
	for (const name of fields) {
		const field = gateway.find((candidate) => candidate.name === name);
		if (!field) continue;
		const needsArguments = field.args.some((argument) =>
			argument.type.kind === "NON_NULL" && argument.defaultValue === null
		);
		if (needsArguments) continue;
		let type: IntrospectedType | null | undefined = field.type;
		while (type?.ofType) type = type.ofType;
		const leaf = type?.kind === "SCALAR" || type?.kind === "ENUM";
		return {
			field: name,
			query: leaf ? `{ ${name} }` : `{ ${name} { __typename } }`,
		};
	}
	return null;
}
