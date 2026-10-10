// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	deploymentTag,
	type GateDeps,
	globToRegExp,
	matchesPaths,
	newestDeployment,
	PAYLOAD_WORKFLOW,
	run,
	versionMessage,
	versionTag,
	workflowPushPaths,
} from "../deploy/await-payload";

const REAL_WORKFLOW = readFileSync(
	new URL(`../../../../../${PAYLOAD_WORKFLOW}`, import.meta.url),
	"utf8",
);
const REAL_TRIGGERS = workflowPushPaths(REAL_WORKFLOW);

const SHA = "0123456789abcdef0123456789abcdef01234567";
const PARENT = "fedcba9876543210fedcba9876543210fedcba98";
const TAG = SHA.slice(0, 12);
const NEWER = "2222222222222222222222222222222222222222";

// Shapes follow wrangler 4.96: `deployments list --json` is an array sorted
// ascending by created_on; `versions view --json` carries an annotations map.
function deployment(id: string, createdOn: string, versionIds: string[]) {
	return {
		id,
		source: "wrangler",
		strategy: "percentage",
		author_email: "ci@example.com",
		created_on: createdOn,
		annotations: { "workers/triggered_by": "deployment" },
		versions: versionIds.map((version_id) => ({
			version_id,
			percentage: 100 / versionIds.length,
		})),
	};
}

function version(id: string, tag?: string, message?: string) {
	const annotations: Record<string, string> = {
		"workers/triggered_by": "upload",
	};
	if (tag) annotations["workers/tag"] = tag;
	if (message) annotations["workers/message"] = message;
	return { id, number: 1, metadata: { source: "wrangler" }, annotations };
}

type Fixture = {
	changed?: string[];
	deployments?: unknown[];
	versions?: Record<string, unknown>;
	env?: Record<string, string | undefined>;
	event?: unknown;
	workflow?: string;
	mode?: GateDeps["mode"];
	// Commits that contain SHA, for `merge-base --is-ancestor`.
	descendants?: string[];
	// Commits missing from the shallow checkout until fetched.
	unfetched?: string[];
};

function harness(fixture: Fixture = {}) {
	const wranglerCalls: string[][] = [];
	const gitCalls: string[][] = [];
	const logs: string[] = [];
	const missing = new Set(fixture.unfetched ?? []);
	let clock = 0;
	const deps: GateDeps = {
		git(args) {
			gitCalls.push(args);
			const command = args.join(" ");
			if (command === "rev-parse HEAD") return `${SHA}\n`;
			if (command === "rev-parse --verify HEAD^") return `${PARENT}\n`;
			if (command === "rev-parse --show-toplevel") return "/repo\n";
			if (command.startsWith("cat-file -e ")) {
				if (missing.has(args[2]?.replace("^{commit}", "") ?? "")) {
					throw new Error("missing");
				}
				return "";
			}
			if (args[0] === "fetch") {
				missing.delete(args.at(-1) ?? "");
				return "";
			}
			if (args[0] === "merge-base") {
				if (args[2] === SHA && fixture.descendants?.includes(args[3] ?? "")) {
					return "";
				}
				throw new Error("not an ancestor");
			}
			if (command.startsWith("-C /repo diff --name-only ")) {
				return `${(fixture.changed ?? []).join("\n")}\n`;
			}
			throw new Error(`unexpected git ${command}`);
		},
		wrangler(args) {
			wranglerCalls.push(args);
			if (args[0] === "deployments") {
				return JSON.stringify(fixture.deployments ?? []);
			}
			const id = args[2] ?? "";
			const found = fixture.versions?.[id];
			if (!found) throw new Error(`no version ${id}`);
			return JSON.stringify(found);
		},
		env: fixture.env ?? {},
		mode: fixture.mode,
		async sleep(ms) {
			clock += ms;
		},
		now: () => clock,
		log: (message) => {
			logs.push(message);
		},
		readFile: (path) =>
			path === `/repo/${PAYLOAD_WORKFLOW}`
				? (fixture.workflow ?? REAL_WORKFLOW)
				: JSON.stringify(fixture.event ?? {}),
	};
	return { deps, wranglerCalls, gitCalls, logs };
}

describe("newestDeployment", () => {
	it("picks the latest created_on regardless of array order", () => {
		const newest = newestDeployment([
			deployment("b", "2026-10-07T12:00:00Z", ["v2"]),
			deployment("c", "2026-10-08T09:00:00Z", ["v3"]),
			deployment("a", "2026-10-06T12:00:00Z", ["v1"]),
		]);
		expect(newest?.id).toBe("c");
	});

	it("rejects anything that is not a list of deployments", () => {
		expect(newestDeployment({ deployments: [] })).toBeUndefined();
		expect(newestDeployment([{ id: "a" }])).toBeUndefined();
		expect(newestDeployment([])).toBeUndefined();
	});
});

describe("versionTag", () => {
	it("reads the workers/tag annotation", () => {
		expect(versionTag(version("v1", TAG))).toBe(TAG);
	});

	it("is undefined when annotations or the tag are missing", () => {
		expect(versionTag(version("v1"))).toBeUndefined();
		expect(versionTag({ id: "v1" })).toBeUndefined();
		expect(versionTag({ annotations: { "workers/tag": 42 } })).toBeUndefined();
		expect(versionTag(null)).toBeUndefined();
	});
});

describe("versionMessage", () => {
	it("reads the workers/message annotation", () => {
		expect(versionMessage(version("v1", TAG, SHA))).toBe(SHA);
		expect(versionMessage(version("v1", TAG))).toBeUndefined();
	});
});

describe("workflowPushPaths", () => {
	it("reads the push paths cuenv generates", () => {
		const yaml = [
			"name: x",
			"on:",
			"  push:",
			"    branches:",
			"    - main",
			"    paths:",
			"    - bun.lock",
			"    - 'cue.mod/**'",
			"  workflow_dispatch: {}",
			"concurrency:",
		].join("\n");
		expect(workflowPushPaths(yaml)).toEqual(["bun.lock", "cue.mod/**"]);
	});

	it("throws when the workflow has no push paths", () => {
		expect(() => workflowPushPaths("on:\n  workflow_dispatch: {}\n")).toThrow();
		expect(() =>
			workflowPushPaths("on:\n  push:\n    branches:\n    - main\n"),
		).toThrow();
	});
});

describe("globToRegExp", () => {
	it("follows GitHub path filter semantics for * and **", () => {
		expect(globToRegExp("a/**").test("a/b/c.ts")).toBe(true);
		expect(globToRegExp("a/*").test("a/b/c.ts")).toBe(false);
		expect(globToRegExp("a/*.ts").test("a/b.ts")).toBe(true);
		expect(globToRegExp("bun.lock").test("bunxlock")).toBe(false);
	});

	it("rejects glob syntax cuenv does not emit", () => {
		expect(() => globToRegExp("a/[ab]")).toThrow();
		expect(() => globToRegExp("!a/**")).toThrow();
	});
});

// These run against the committed rawkode-academy-payload-default.yml, so the
// gate's notion of "this push deploys Payload" is the workflow's own filter.
describe("matchesPaths against the Payload workflow", () => {
	it("includes Payload sources, the lockfile and the CUE module", () => {
		for (const file of [
			"projects/rawkode.academy/payload/app/(payload)/api/review/route.ts",
			"projects/rawkode.academy/payload/container/Dockerfile",
			"projects/rawkode.academy/payload/cloudflare-env.d.ts",
			"projects/rawkode.academy/payload/wrangler.preview-runtime.jsonc",
			"bun.lock",
			"cue.mod/module.cue",
			PAYLOAD_WORKFLOW,
		]) {
			expect(matchesPaths([file], REAL_TRIGGERS), file).toBe(true);
		}
	});

	it("excludes files that do not start a Payload run", () => {
		for (const file of [
			"projects/rawkode.academy/payload/README.md",
			"projects/rawkode.academy/payload/AGENTS.md",
			"projects/rawkode.academy/website/review/bridge.ts",
			"projects/rawkode.academy/payload-notes.md",
		]) {
			expect(matchesPaths([file], REAL_TRIGGERS), file).toBe(false);
		}
	});
});

describe("deploymentTag", () => {
	it("uses exactly the first 12 characters of a full SHA", () => {
		expect(deploymentTag(SHA)).toBe("0123456789ab");
	});

	it("rejects anything that is not a full SHA", () => {
		for (const value of ["", "0123456789ab", `${SHA}0`, SHA.toUpperCase()]) {
			expect(() => deploymentTag(value)).toThrow();
		}
	});
});

describe("run", () => {
	const payloadChange = [
		"projects/rawkode.academy/payload/src/review/service.ts",
	];

	it("passes once the newest deployment carries this commit's tag", async () => {
		const { deps } = harness({
			changed: payloadChange,
			deployments: [
				deployment("old", "2026-10-07T12:00:00Z", ["v1"]),
				deployment("new", "2026-10-08T12:00:00Z", ["v2"]),
			],
			versions: { v1: version("v1", "aaaaaaaaaaaa"), v2: version("v2", TAG) },
		});
		await expect(run(deps)).resolves.toBe(0);
	});

	it("does not accept the tag on an older deployment and times out", async () => {
		const { deps, logs } = harness({
			changed: payloadChange,
			env: { REVIEW_PAYLOAD_WAIT_SECONDS: "60" },
			deployments: [
				deployment("tagged", "2026-10-07T12:00:00Z", ["v1"]),
				deployment("rollback", "2026-10-08T12:00:00Z", ["v2"]),
			],
			versions: { v1: version("v1", TAG), v2: version("v2") },
		});
		await expect(run(deps)).resolves.toBe(1);
		expect(logs.at(-1)).toContain(`has not deployed ${TAG}`);
	});

	it("matches a split deployment when either version carries the tag", async () => {
		const { deps } = harness({
			changed: payloadChange,
			deployments: [deployment("split", "2026-10-08T12:00:00Z", ["v1", "v2"])],
			versions: { v1: version("v1", "aaaaaaaaaaaa"), v2: version("v2", TAG) },
		});
		await expect(run(deps)).resolves.toBe(0);
	});

	it("retries after a wrangler failure", async () => {
		const { deps, logs } = harness({
			changed: payloadChange,
			env: { REVIEW_PAYLOAD_WAIT_SECONDS: "60" },
		});
		const original = deps.wrangler;
		let failures = 1;
		deps.wrangler = (args) => {
			if (failures > 0) {
				failures -= 1;
				throw new Error("network");
			}
			return original(args);
		};
		await expect(run(deps)).resolves.toBe(1);
		expect(logs.some((line) => line.includes("will retry"))).toBe(true);
	});

	it("accepts a newer Payload deploy that contains this commit", async () => {
		const { deps, gitCalls } = harness({
			changed: payloadChange,
			descendants: [NEWER],
			unfetched: [NEWER],
			deployments: [deployment("newer", "2026-10-08T12:00:00Z", ["v2"])],
			versions: { v2: version("v2", NEWER.slice(0, 12), NEWER) },
		});
		await expect(run(deps)).resolves.toBe(0);
		expect(gitCalls.some((args) => args[0] === "fetch")).toBe(true);
	});

	it("does not accept a deploy of an unrelated commit", async () => {
		const { deps, gitCalls } = harness({
			changed: payloadChange,
			env: { REVIEW_PAYLOAD_WAIT_SECONDS: "60" },
			deployments: [deployment("other", "2026-10-08T12:00:00Z", ["v2"])],
			versions: { v2: version("v2", NEWER.slice(0, 12), NEWER) },
		});
		await expect(run(deps)).resolves.toBe(1);
		// The ancestry answer is cached across polls.
		expect(gitCalls.filter((args) => args[0] === "merge-base")).toHaveLength(1);
	});

	it("skips without calling wrangler when REVIEW_SKIP_PAYLOAD_WAIT=1", async () => {
		const { deps, wranglerCalls } = harness({
			changed: payloadChange,
			env: { REVIEW_SKIP_PAYLOAD_WAIT: "1" },
		});
		await expect(run(deps)).resolves.toBe(0);
		expect(wranglerCalls).toHaveLength(0);
	});

	it("skips when the dispatch form sets skip_payload_wait", async () => {
		for (const value of [true, "true"]) {
			const { deps, wranglerCalls } = harness({
				changed: payloadChange,
				env: { GITHUB_EVENT_PATH: "/event.json" },
				event: { inputs: { skip_payload_wait: value } },
			});
			await expect(run(deps)).resolves.toBe(0);
			expect(wranglerCalls).toHaveLength(0);
		}
	});

	it("waits when the dispatch form leaves skip_payload_wait unset", async () => {
		const { deps, wranglerCalls } = harness({
			changed: payloadChange,
			env: {
				GITHUB_EVENT_PATH: "/event.json",
				REVIEW_PAYLOAD_WAIT_SECONDS: "0",
			},
			event: { inputs: { skip_payload_wait: "false" } },
		});
		await expect(run(deps)).resolves.toBe(1);
		expect(wranglerCalls.length).toBeGreaterThan(0);
	});

	it("production mode ignores review skip flags", async () => {
		const { deps, wranglerCalls } = harness({
			changed: payloadChange,
			mode: "production",
			env: {
				GITHUB_EVENT_PATH: "/event.json",
				REVIEW_SKIP_PAYLOAD_WAIT: "1",
				REVIEW_PAYLOAD_WAIT_SECONDS: "0",
			},
			event: { inputs: { skip_payload_wait: true } },
		});
		await expect(run(deps)).resolves.toBe(1);
		expect(wranglerCalls.length).toBeGreaterThan(0);
	});

	it("does not wait when the push does not trigger the Payload workflow", async () => {
		const { deps, wranglerCalls, logs } = harness({
			changed: [
				"projects/rawkode.academy/website/review/bridge.ts",
				"projects/rawkode.academy/payload/README.md",
			],
		});
		await expect(run(deps)).resolves.toBe(0);
		expect(wranglerCalls).toHaveLength(0);
		expect(logs.at(-1)).toContain("does not trigger");
	});

	it("fails loudly when the Payload workflow has no push paths", async () => {
		const { deps } = harness({
			changed: payloadChange,
			workflow: "on:\n  workflow_dispatch: {}\n",
		});
		await expect(run(deps)).rejects.toThrow();
	});

	it("diffs from the push event's before SHA when it is available", async () => {
		const before = "1111111111111111111111111111111111111111";
		const { deps } = harness({
			changed: [],
			env: { GITHUB_EVENT_PATH: "/event.json" },
			event: { before },
		});
		const seen: string[][] = [];
		const git = deps.git;
		deps.git = (args) => {
			seen.push(args);
			return git(args);
		};
		await expect(run(deps)).resolves.toBe(0);
		expect(seen).toContainEqual([
			"-C",
			"/repo",
			"diff",
			"--name-only",
			before,
			"HEAD",
		]);
	});
});
