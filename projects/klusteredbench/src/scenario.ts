import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { parseDuration } from "./util/time.ts";

export type Difficulty = "easy" | "medium" | "hard";

export interface ScenarioManifest {
	id: string;
	title: string;
	difficulty: Difficulty;
	tags: string[];
	/** Where the break came from, e.g. a Klustered lab or episode. */
	source?: string;
	/** Agent wall-clock budget, e.g. "15m". Overrides the bench default. */
	timeout?: string;
	/** The task statement handed to the agent. */
	prompt: string;
	/** Reference only. Never shown to the agent. */
	solution?: string;
	/** Script file names, relative to the scenario directory. */
	scripts?: Partial<Record<ScriptKind, string>>;
	/** Set to true for scenarios that reboot/replace control-plane components. */
	nodeLevel?: boolean;
}

export type ScriptKind = "setup" | "break" | "verify" | "solve" | "invariants";

export interface Scenario extends Omit<ScenarioManifest, "scripts"> {
	dir: string;
	timeoutMs: number | null;
	scripts: Record<ScriptKind, string | null>;
	/** Shared bash prelude prepended to every script. */
	prelude: string;
}

const DEFAULT_SCRIPT_FILES: Record<ScriptKind, string> = {
	setup: "setup.sh",
	break: "break.sh",
	verify: "verify.sh",
	solve: "solve.sh",
	invariants: "invariants.sh",
};

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SCENARIOS_DIR = resolve(here, "..", "scenarios");

async function readIfExists(path: string): Promise<string | null> {
	try {
		return await readFile(path, "utf8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw err;
	}
}

function assertManifest(raw: unknown, dir: string): ScenarioManifest {
	if (!raw || typeof raw !== "object")
		throw new Error(`${dir}: scenario.yaml is empty`);
	const m = raw as Record<string, unknown>;
	for (const key of ["id", "title", "difficulty", "prompt"]) {
		if (typeof m[key] !== "string" || !(m[key] as string).trim()) {
			throw new Error(
				`${dir}: scenario.yaml is missing required string "${key}"`,
			);
		}
	}
	if (!["easy", "medium", "hard"].includes(m.difficulty as string)) {
		throw new Error(`${dir}: difficulty must be easy|medium|hard`);
	}
	if (m.tags !== undefined && !Array.isArray(m.tags)) {
		throw new Error(`${dir}: tags must be a list`);
	}
	return {
		id: m.id as string,
		title: m.title as string,
		difficulty: m.difficulty as Difficulty,
		tags: (m.tags as string[] | undefined) ?? [],
		source: m.source as string | undefined,
		timeout: m.timeout as string | undefined,
		prompt: (m.prompt as string).trim(),
		solution: m.solution as string | undefined,
		scripts: m.scripts as ScenarioManifest["scripts"],
		nodeLevel: Boolean(m.nodeLevel),
	};
}

export async function loadScenario(
	dir: string,
	scenariosRoot: string = DEFAULT_SCENARIOS_DIR,
): Promise<Scenario> {
	const manifestText = await readFile(join(dir, "scenario.yaml"), "utf8");
	const manifest = assertManifest(parse(manifestText), dir);
	const scripts = {} as Record<ScriptKind, string | null>;
	for (const kind of Object.keys(DEFAULT_SCRIPT_FILES) as ScriptKind[]) {
		const file = manifest.scripts?.[kind] ?? DEFAULT_SCRIPT_FILES[kind];
		scripts[kind] = await readIfExists(join(dir, file));
	}
	// Scenarios may omit setup.sh to use the shared baseline app.
	if (scripts.setup === null) {
		scripts.setup = await readIfExists(join(scenariosRoot, "_lib", "setup.sh"));
	}
	for (const required of ["break", "verify"] as const) {
		if (scripts[required] === null) {
			throw new Error(`${dir}: missing ${DEFAULT_SCRIPT_FILES[required]}`);
		}
	}
	const prelude =
		(await readIfExists(join(scenariosRoot, "_lib", "prelude.sh"))) ?? "";
	const dirName = dir.split("/").filter(Boolean).pop();
	if (dirName !== manifest.id) {
		throw new Error(
			`${dir}: scenario id "${manifest.id}" must match its directory name`,
		);
	}
	return {
		...manifest,
		dir,
		timeoutMs: manifest.timeout ? parseDuration(manifest.timeout) : null,
		scripts,
		prelude,
	};
}

export async function loadScenarios(
	scenariosRoot: string = DEFAULT_SCENARIOS_DIR,
	filter?: string[],
): Promise<Scenario[]> {
	const entries = await readdir(scenariosRoot);
	const out: Scenario[] = [];
	for (const entry of entries.sort()) {
		if (entry.startsWith("_") || entry.startsWith(".")) continue;
		const dir = join(scenariosRoot, entry);
		if (!(await stat(dir)).isDirectory()) continue;
		if (filter && filter.length > 0 && !filter.includes(entry)) continue;
		out.push(await loadScenario(dir, scenariosRoot));
	}
	if (filter && filter.length > 0) {
		const found = new Set(out.map((s) => s.id));
		const missing = filter.filter((id) => !found.has(id));
		if (missing.length > 0)
			throw new Error(`Unknown scenario(s): ${missing.join(", ")}`);
	}
	return out;
}

/** Full script text as executed on the node: prelude + script. */
export function renderScript(
	scenario: Scenario,
	kind: ScriptKind,
): string | null {
	const body = scenario.scripts[kind];
	if (body === null) return null;
	return `${scenario.prelude}\n${body}`;
}
