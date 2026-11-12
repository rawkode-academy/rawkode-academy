import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import {
	compare,
	countDeclared,
	type DeclaredService,
	declaredWorker,
	gatewaySubgraphs,
	liveQuery,
	parseJsonWithComments,
	rootFields,
} from "./platform_service.ts";

const configuration = `{
	// The worker
	"name": "platform-example-read-model", /* inline */
	"workers_dev": true,
	"vars": { "URL": "https://example.dev/a//b", "NOTE": "a /* b */ \\"c\\", ]" },
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "platform-example",
			"database_id": "11111111-1111-1111-1111-111111111111",
		},
	],
	"queues": {
		"producers": [{ "binding": "OUT", "queue": "example-out" }],
		"consumers": [
			{ "queue": "example-in", "dead_letter_queue": "example-dead" },
			{ "queue": "example-in" }, // repeated
		],
	},
	"services": [{ "binding": "ANALYTICS", "service": "collector" }],
	"r2_buckets": [{ "binding": "FILES", "bucket_name": "content" }],
	"workflows": [{ "binding": "RUN", "name": "run", "class_name": "Run" }],
	"routes": [{ "pattern": "example.dev", "custom_domain": true }, "example.dev/*"],
	"triggers": { "crons": ["0 * * * *"] },
	"ai": { "binding": "AI" },
}`;

function service(): DeclaredService {
	return {
		name: "example",
		directory: "platform/example",
		workers: [
			declaredWorker(
				parseJsonWithComments(configuration),
				"platform/example/read-model/wrangler.jsonc",
			)!,
		],
	};
}

const live = {
	databases: [
		{ uuid: "11111111-1111-1111-1111-111111111111", name: "platform-example" },
	],
	queues: [
		{ queue_name: "example-out" },
		{ queue_name: "example-in" },
		{ queue_name: "example-dead" },
	],
	workers: [
		{ id: "platform-example-read-model" },
		{ id: "collector" },
		{ id: "collector" },
	],
};

Deno.test("comments and trailing commas are ignored, strings are kept", () => {
	const parsed = parseJsonWithComments(configuration) as {
		vars: Record<string, string>;
	};
	assertEquals(parsed.vars.URL, "https://example.dev/a//b");
	assertEquals(parsed.vars.NOTE, 'a /* b */ "c", ]');
	assertThrows(() => parseJsonWithComments("{ nope }"));
});

Deno.test("a configuration yields its worker and bindings", () => {
	const worker = service().workers[0];
	assertEquals(worker.name, "platform-example-read-model");
	assertEquals(worker.workersDevelopment, true);
	assertEquals(worker.databases, [{
		binding: "DB",
		name: "platform-example",
		identifier: "11111111-1111-1111-1111-111111111111",
	}]);
	assertEquals(worker.queues, [
		{ name: "example-out", role: "producer" },
		{ name: "example-in", role: "consumer" },
		{ name: "example-dead", role: "dead-letter" },
	]);
	assertEquals(worker.serviceBindings, [
		{ binding: "ANALYTICS", worker: "collector" },
	]);
	assertEquals(worker.buckets, [{ binding: "FILES", name: "content" }]);
	assertEquals(worker.routes, ["example.dev", "example.dev/*"]);
	assertEquals(worker.schedules, ["0 * * * *"]);
	assertEquals(worker.otherBindings, ["ai"]);
	assertEquals(declaredWorker({ main: "main.ts" }, "wrangler.jsonc"), null);
	assertEquals(declaredWorker([], "wrangler.jsonc"), null);
});

Deno.test("distinct declared things are counted once", () => {
	const example = service();
	const second = { ...example, name: "second" };
	assertEquals(countDeclared([example, second]), {
		services: 2,
		workers: 1,
		databases: 1,
		queues: 3,
		serviceBindingTargets: 1,
		buckets: 1,
		workflows: 1,
	});
});

Deno.test("gateway bindings are tied to the service that declares them", () => {
	const gateway = declaredWorker({
		name: "gateway",
		services: [
			{ binding: "EXAMPLE", service: "platform-example-read-model" },
			{ binding: "IDENTITY", service: "identity" },
		],
	}, "api/wrangler.jsonc");
	assertEquals(gatewaySubgraphs(gateway, [service()]), [
		{
			binding: "EXAMPLE",
			worker: "platform-example-read-model",
			service: "example",
			workersDevelopment: true,
		},
		{
			binding: "IDENTITY",
			worker: "identity",
			service: null,
			workersDevelopment: false,
		},
	]);
	assertEquals(gatewaySubgraphs(null, [service()]), []);
});

Deno.test("a deployment that matches has no problems", () => {
	const verdict = compare([service()], live);
	assertEquals(verdict.ok, true);
	assertEquals(verdict.problems, []);
	assertEquals(verdict.services[0].matches, [
		"worker platform-example-read-model",
		"database platform-example (11111111-1111-1111-1111-111111111111)",
		"queue example-out",
		"queue example-in",
		"queue example-dead",
		"service binding target collector",
	]);
	assertEquals(verdict.counts, {
		services: 1,
		servicesWithProblems: 0,
		matches: 6,
		problems: 0,
	});
	assertEquals(
		verdict.summary,
		"All 1 services are deployed as declared (6 checks).",
	);
});

Deno.test("everything missing is reported by kind", () => {
	const verdict = compare([service()], {
		databases: [],
		queues: [{ queue_name: "example-in" }],
		workers: [],
	});
	assertEquals(verdict.ok, false);
	assertEquals(
		verdict.problems.map((problem) => [problem.kind, problem.subject]),
		[
			["worker-missing", "platform-example-read-model"],
			["database-missing", "platform-example"],
			["queue-missing", "example-out"],
			["queue-missing", "example-dead"],
			["service-binding-target-missing", "collector"],
		],
	);
	assertEquals(verdict.services[0].matches, ["queue example-in"]);
	assertEquals(verdict.counts.servicesWithProblems, 1);
	assertEquals(
		verdict.summary.split("\n")[0],
		"1 of 1 services differ from what they declare:",
	);
});

Deno.test("a database under another id or name is a mismatch, not missing", () => {
	const otherIdentifier = compare([service()], {
		...live,
		databases: [{ uuid: "22222222", name: "platform-example" }],
	});
	assertEquals(otherIdentifier.problems.length, 1);
	assertEquals(
		otherIdentifier.problems[0].kind,
		"database-identifier-mismatch",
	);
	assertEquals(
		otherIdentifier.problems[0].expected,
		"11111111-1111-1111-1111-111111111111",
	);
	assertEquals(otherIdentifier.problems[0].actual, "22222222");

	const otherName = compare([service()], {
		...live,
		databases: [
			{ uuid: "11111111-1111-1111-1111-111111111111", name: "renamed" },
		],
	});
	assertEquals(otherName.problems.length, 1);
	assertEquals(otherName.problems[0].kind, "database-name-mismatch");
	assertEquals(otherName.problems[0].actual, "renamed");
});

const schema = `
extend schema @link(url: "https://specs.apollo.dev/federation/v2.6", import: ["@key"])

"""
A date: such as { 2007-12-03 }
"""
scalar Date

type Example @key(fields: "id") {
  id: String!
  query: String
}

type Query {
  """Find one: by id"""
  exampleById(id: String!): Example
  examples(
    limit: Int = 15
    filter: ExampleFilter = { status: "live" }
  ): [Example!]!
  exampleCount: Int!
  _entities(representations: [_Any!]!): [_Entity]!
  _service: _Service!
}

type Mutation {
  rename(id: String!): Example
}
`;

Deno.test("root fields are read from a subgraph schema", () => {
	assertEquals(rootFields(schema), [
		"exampleById",
		"examples",
		"exampleCount",
	]);
	assertEquals(rootFields(schema, "Mutation"), ["rename"]);
	assertEquals(rootFields("type Example { id: String }"), []);
});

Deno.test("the live query is the first field that needs no arguments", () => {
	const required = { type: { kind: "NON_NULL" }, defaultValue: null };
	const optional = { type: { kind: "SCALAR" }, defaultValue: null };
	const defaulted = { type: { kind: "NON_NULL" }, defaultValue: "15" };
	const list = {
		kind: "NON_NULL",
		ofType: {
			kind: "LIST",
			ofType: { kind: "NON_NULL", ofType: { kind: "OBJECT" } },
		},
	};
	const gateway = [
		{ name: "exampleById", args: [required], type: { kind: "OBJECT" } },
		{ name: "examples", args: [optional, defaulted], type: list },
		{
			name: "exampleCount",
			args: [],
			type: { kind: "NON_NULL", ofType: { kind: "SCALAR" } },
		},
	];
	assertEquals(liveQuery(["exampleById", "examples"], gateway), {
		field: "examples",
		query: "{ examples { __typename } }",
	});
	assertEquals(liveQuery(["exampleCount"], gateway), {
		field: "exampleCount",
		query: "{ exampleCount }",
	});
	assertEquals(liveQuery(["exampleById", "unknown"], gateway), null);
});
