// Gate for the review frontend deploy. preview.rawkode.academy forwards its
// API traffic to the rawkode-academy-payload Worker, so when a commit changes
// Payload the review frontend must not go live before that Payload deploy.
// Payload's deploy.main tags each version with the first 12 characters of the
// commit SHA and sets the version message to the full SHA; this gate polls
// Cloudflare until the active deployment carries this commit or a descendant.

export const PAYLOAD_WORKER = "rawkode-academy-payload";

// The gate waits only when the Payload workflow will actually run, so it reads
// that workflow's push path filter instead of keeping its own copy.
export const PAYLOAD_WORKFLOW =
	".github/workflows/rawkode-academy-payload-default.yml";

const FULL_SHA = /^[0-9a-f]{40}$/;
const ZERO_SHA = "0".repeat(40);
const POLL_INTERVAL_MS = 20_000;
const DEFAULT_WAIT_SECONDS = 1500;
// Enough history to relate a newer Payload deploy to this commit after a
// burst of pushes, without unshallowing the checkout.
const ANCESTRY_FETCH_DEPTH = 200;

export type Deployment = {
	id: string;
	created_on: string;
	versions: ReadonlyArray<{ version_id: string; percentage: number }>;
};

export type DeployedVersion = { tag?: string; message?: string };

export type GateDeps = {
	git(args: string[]): string;
	wrangler(args: string[]): string;
	env: Record<string, string | undefined>;
	sleep(ms: number): Promise<void>;
	now(): number;
	log(message: string): void;
	readFile(path: string): string;
};

// Reads `on.push.paths` from the generated workflow. cuenv emits a fixed
// layout (two-space indent, one `- path` per line), which this relies on; any
// other shape throws so the gate fails loudly instead of guessing.
export function workflowPushPaths(yaml: string): string[] {
	const lines = yaml.split("\n");
	const push = lines.findIndex((line) => line === "  push:");
	if (push === -1) throw new Error("workflow has no on.push trigger");
	const paths: string[] = [];
	let inPaths = false;
	for (const line of lines.slice(push + 1)) {
		if (!line.startsWith("    ")) break;
		if (line === "    paths:") {
			inPaths = true;
			continue;
		}
		if (!inPaths) continue;
		const item = /^ {4}- (.+)$/.exec(line);
		if (!item?.[1]) break;
		paths.push(item[1].replace(/^(['"])(.*)\1$/, "$2"));
	}
	if (paths.length === 0) throw new Error("workflow on.push has no paths");
	return paths;
}

// GitHub path filter globs as cuenv emits them: `**` crosses directories and
// `*` stays within one segment. Other glob syntax is rejected.
export function globToRegExp(glob: string): RegExp {
	if (/[?[\]!+]/.test(glob)) {
		throw new Error(`Unsupported path filter "${glob}"`);
	}
	let source = "";
	for (let index = 0; index < glob.length; index += 1) {
		const char = glob.charAt(index);
		if (char === "*" && glob.charAt(index + 1) === "*") {
			source += ".*";
			index += 1;
		} else if (char === "*") {
			source += "[^/]*";
		} else {
			source += char.replace(/[.^$(){}|\\]/g, "\\$&");
		}
	}
	return new RegExp(`^${source}$`);
}

export function matchesPaths(
	changedFiles: readonly string[],
	globs: readonly string[],
): boolean {
	const patterns = globs.map(globToRegExp);
	return changedFiles.some((file) =>
		patterns.some((pattern) => pattern.test(file)),
	);
}

export function deploymentTag(sha: string): string {
	if (!FULL_SHA.test(sha)) {
		throw new Error(`Expected a full 40-character commit SHA, got "${sha}"`);
	}
	return sha.slice(0, 12);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asDeployment(value: unknown): Deployment | undefined {
	if (!isRecord(value)) return undefined;
	const id = value["id"];
	const createdOn = value["created_on"];
	const versions = value["versions"];
	if (typeof id !== "string" || typeof createdOn !== "string") return undefined;
	if (Number.isNaN(Date.parse(createdOn)) || !Array.isArray(versions)) {
		return undefined;
	}
	const parsed: Array<{ version_id: string; percentage: number }> = [];
	for (const version of versions) {
		if (!isRecord(version)) return undefined;
		const versionId = version["version_id"];
		const percentage = version["percentage"];
		if (typeof versionId !== "string" || typeof percentage !== "number") {
			return undefined;
		}
		parsed.push({ version_id: versionId, percentage });
	}
	return { id, created_on: createdOn, versions: parsed };
}

// `wrangler deployments list --json` returns every deployment; the active one
// is the most recent. Selection uses created_on rather than array position so
// the ordering wrangler happens to emit does not matter.
export function newestDeployment(raw: unknown): Deployment | undefined {
	if (!Array.isArray(raw)) return undefined;
	let newest: Deployment | undefined;
	for (const entry of raw) {
		const deployment = asDeployment(entry);
		if (!deployment) return undefined;
		if (
			!newest ||
			Date.parse(deployment.created_on) > Date.parse(newest.created_on)
		) {
			newest = deployment;
		}
	}
	return newest;
}

function annotation(raw: unknown, key: string): string | undefined {
	if (!isRecord(raw)) return undefined;
	const annotations = raw["annotations"];
	if (!isRecord(annotations)) return undefined;
	const value = annotations[key];
	return typeof value === "string" ? value : undefined;
}

export function versionTag(raw: unknown): string | undefined {
	return annotation(raw, "workers/tag");
}

export function versionMessage(raw: unknown): string | undefined {
	return annotation(raw, "workers/message");
}

function readEvent(deps: GateDeps): Record<string, unknown> | undefined {
	const eventPath = deps.env["GITHUB_EVENT_PATH"];
	if (!eventPath) return undefined;
	try {
		const event: unknown = JSON.parse(deps.readFile(eventPath));
		return isRecord(event) ? event : undefined;
	} catch {
		return undefined;
	}
}

// The website workflow's dispatch form exposes `skip_payload_wait`. Boolean
// inputs reach the event payload as either a boolean or the string "true".
function skipRequested(
	deps: GateDeps,
	event: Record<string, unknown> | undefined,
): boolean {
	if (deps.env["REVIEW_SKIP_PAYLOAD_WAIT"] === "1") return true;
	const inputs = event?.["inputs"];
	if (!isRecord(inputs)) return false;
	const value = inputs["skip_payload_wait"];
	return value === true || value === "true";
}

function pushedBase(
	deps: GateDeps,
	event: Record<string, unknown> | undefined,
): string | undefined {
	const before = event?.["before"];
	if (
		typeof before === "string" &&
		FULL_SHA.test(before) &&
		before !== ZERO_SHA
	) {
		try {
			deps.git(["cat-file", "-e", `${before}^{commit}`]);
			return before;
		} catch {
			// The shallow checkout may not contain the pushed range's base; fall
			// through to the parent commit.
		}
	}
	try {
		return deps.git(["rev-parse", "--verify", "HEAD^"]).trim();
	} catch {
		return undefined;
	}
}

function deployedVersions(deps: GateDeps): DeployedVersion[] {
	const deployment = newestDeployment(
		JSON.parse(
			deps.wrangler([
				"deployments",
				"list",
				"--name",
				PAYLOAD_WORKER,
				"--json",
			]),
		),
	);
	if (!deployment) return [];
	return deployment.versions.map((version) => {
		const raw: unknown = JSON.parse(
			deps.wrangler([
				"versions",
				"view",
				version.version_id,
				"--name",
				PAYLOAD_WORKER,
				"--json",
			]),
		);
		const tag = versionTag(raw);
		const message = versionMessage(raw);
		return {
			...(tag === undefined ? {} : { tag }),
			...(message === undefined ? {} : { message }),
		};
	});
}

// True when `descendant` contains `sha`. A Payload run for this commit can be
// cancelled by a newer push; the newer deploy still carries this change.
function contains(
	deps: GateDeps,
	sha: string,
	descendant: string,
	known: Map<string, boolean>,
): boolean {
	if (descendant === sha) return true;
	const cached = known.get(descendant);
	if (cached !== undefined) return cached;
	try {
		deps.git(["cat-file", "-e", `${descendant}^{commit}`]);
	} catch {
		try {
			deps.git([
				"fetch",
				"--no-tags",
				"--quiet",
				`--depth=${ANCESTRY_FETCH_DEPTH}`,
				"origin",
				descendant,
			]);
		} catch {
			// Not cached: a transient fetch failure is retried on the next poll.
			return false;
		}
	}
	let result: boolean;
	try {
		deps.git(["merge-base", "--is-ancestor", sha, descendant]);
		result = true;
	} catch {
		result = false;
	}
	known.set(descendant, result);
	return result;
}

export async function run(deps: GateDeps): Promise<0 | 1> {
	const event = readEvent(deps);
	if (skipRequested(deps, event)) {
		deps.log("Payload wait skipped on request; not waiting for Payload");
		return 0;
	}

	const sha = deps.git(["rev-parse", "HEAD"]).trim();
	const tag = deploymentTag(sha);

	const base = pushedBase(deps, event);
	if (!base) {
		deps.log("No parent commit; not waiting");
		return 0;
	}

	const root = deps.git(["rev-parse", "--show-toplevel"]).trim();
	const triggers = workflowPushPaths(
		deps.readFile(`${root}/${PAYLOAD_WORKFLOW}`),
	);
	const changed = deps
		.git(["-C", root, "diff", "--name-only", base, "HEAD"])
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (!matchesPaths(changed, triggers)) {
		deps.log(`${sha} does not trigger ${PAYLOAD_WORKFLOW}; not waiting`);
		return 0;
	}

	const configured = Number(
		deps.env["REVIEW_PAYLOAD_WAIT_SECONDS"] ?? DEFAULT_WAIT_SECONDS,
	);
	const waitSeconds = Number.isNaN(configured)
		? DEFAULT_WAIT_SECONDS
		: configured;
	const deadline = deps.now() + waitSeconds * 1000;
	deps.log(
		`Waiting up to ${waitSeconds}s for ${PAYLOAD_WORKER} to serve ${tag} or a newer commit`,
	);

	const known = new Map<string, boolean>();
	for (;;) {
		try {
			const versions = deployedVersions(deps);
			const serving = versions.find(
				(version) =>
					version.tag === tag ||
					(version.message !== undefined &&
						FULL_SHA.test(version.message) &&
						contains(deps, sha, version.message, known)),
			);
			if (serving) {
				deps.log(
					`${PAYLOAD_WORKER} is serving ${serving.tag ?? serving.message}, which includes ${tag}`,
				);
				return 0;
			}
			const tags = versions.flatMap((version) =>
				version.tag ? [version.tag] : [],
			);
			deps.log(
				`${PAYLOAD_WORKER} active tags: ${tags.length > 0 ? tags.join(", ") : "(none)"}; waiting for ${tag}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			deps.log(
				`Could not read ${PAYLOAD_WORKER} deployments (will retry): ${message}`,
			);
		}
		if (deps.now() >= deadline) break;
		await deps.sleep(POLL_INTERVAL_MS);
	}

	deps.log(
		`${PAYLOAD_WORKER} has not deployed ${tag} or a newer commit. Check the rawkode-academy-payload-default run for this commit; an out-of-band 'wrangler secret put' or rollback also creates an untagged newest deployment. Once Payload is confirmed deployed, run the rawkode-academy-website-default workflow manually with "skip_payload_wait" checked (this redeploys the review frontend only when the commit at the head of main changes review inputs), or deploy it locally from projects/rawkode.academy/website with REVIEW_SKIP_PAYLOAD_WAIT=1 cuenv -e production task deploy.review.`,
	);
	return 1;
}
