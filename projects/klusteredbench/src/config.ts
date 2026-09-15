import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { AgentConfig } from "./agents/index.ts";
import type { ModelPrice } from "./pricing.ts";
import type { ProviderConfig } from "./providers/index.ts";
import { parseDuration } from "./util/time.ts";

export interface BenchConfig {
	provider: ProviderConfig;
	agents: AgentConfig[];
	/** Scenario ids, or "all". */
	scenarios: string[] | "all";
	trials: number;
	/** Default agent budget; scenarios may override. */
	timeoutMs: number;
	/** How often the harness runs verify while the agent works. */
	pollIntervalMs: number;
	/** Per-command cap for anything the agent runs. */
	commandTimeoutMs: number;
	/** Stop the agent as soon as verify passes. Cheaper, but hides post-fix damage. */
	stopOnGreen: boolean;
	/** How many trials run concurrently (each needs its own cluster). */
	parallel: number;
	outDir: string;
	pricing?: Record<string, ModelPrice>;
	scenariosDir?: string;
}

export const DEFAULTS = {
	trials: 1,
	timeout: "15m",
	pollInterval: "5s",
	commandTimeout: "5m",
	stopOnGreen: false,
	parallel: 1,
	outDir: "results",
} as const;

export function parseBenchConfig(raw: unknown): BenchConfig {
	if (!raw || typeof raw !== "object") throw new Error("bench config is empty");
	const c = raw as Record<string, unknown>;
	if (!c.provider || typeof c.provider !== "object")
		throw new Error("config.provider is required");
	if (!Array.isArray(c.agents) || c.agents.length === 0) {
		throw new Error("config.agents must be a non-empty list");
	}
	const names = new Set<string>();
	for (const a of c.agents as Array<Record<string, unknown>>) {
		if (typeof a.name !== "string" || typeof a.type !== "string") {
			throw new Error("every agent needs a string name and type");
		}
		if (names.has(a.name)) throw new Error(`duplicate agent name: ${a.name}`);
		names.add(a.name);
	}
	const scenarios =
		c.scenarios === undefined || c.scenarios === "all"
			? "all"
			: (c.scenarios as string[]);
	if (scenarios !== "all" && !Array.isArray(scenarios)) {
		throw new Error(`config.scenarios must be "all" or a list`);
	}
	return {
		provider: c.provider as ProviderConfig,
		agents: c.agents as AgentConfig[],
		scenarios,
		trials: Number(c.trials ?? DEFAULTS.trials),
		timeoutMs: parseDuration(
			(c.timeout as string | number | undefined) ?? DEFAULTS.timeout,
		),
		pollIntervalMs: parseDuration(
			(c.pollInterval as string | number | undefined) ?? DEFAULTS.pollInterval,
		),
		commandTimeoutMs: parseDuration(
			(c.commandTimeout as string | number | undefined) ??
				DEFAULTS.commandTimeout,
		),
		stopOnGreen: Boolean(c.stopOnGreen ?? DEFAULTS.stopOnGreen),
		parallel: Number(c.parallel ?? DEFAULTS.parallel),
		outDir: String(c.outDir ?? DEFAULTS.outDir),
		pricing: c.pricing as Record<string, ModelPrice> | undefined,
		scenariosDir: c.scenariosDir as string | undefined,
	};
}

export async function loadBenchConfig(path: string): Promise<BenchConfig> {
	return parseBenchConfig(parse(await readFile(path, "utf8")));
}
