#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createAgent } from "./agents/index.ts";
import { type BenchConfig, loadBenchConfig } from "./config.ts";
import { aggregate, collectResults, renderMarkdown } from "./report.ts";
import type { RunSummary } from "./results.ts";
import { runAll, type TrialSpec } from "./runner.ts";
import { DEFAULT_SCENARIOS_DIR, loadScenarios } from "./scenario.ts";
import { validateScenario } from "./validate.ts";

const USAGE = `klusteredbench - evaluate LLM agents against broken Kubernetes clusters

Usage:
  klusteredbench scenarios list
  klusteredbench scenarios validate [--config bench.yaml] [id ...]
  klusteredbench run [--config bench.yaml] [--scenario id]... [--agent name]... [--trials N] [--out DIR] [--parallel N] [--stop-on-green]
  klusteredbench report DIR [--md FILE] [--json FILE]

A run writes results/<runId>/<scenario>/<agent>/trial-N/{result.json,transcript.jsonl,*.log}
plus results/<runId>/summary.{json,md}. \`report\` re-aggregates any tree of result.json files.`;

function runId(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

const say = (line: string) =>
	console.error(`${new Date().toISOString()} ${line}`);

async function cmdScenariosList(dir: string): Promise<void> {
	const scenarios = await loadScenarios(dir);
	for (const s of scenarios) {
		console.log(
			`${s.id.padEnd(40)} ${s.difficulty.padEnd(7)} ${(s.timeout ?? "-").padEnd(5)} ${s.nodeLevel ? "node " : "     "} ${s.tags.join(",")}`,
		);
	}
}

async function cmdScenariosValidate(
	config: BenchConfig,
	ids: string[],
): Promise<number> {
	const scenarios = await loadScenarios(
		config.scenariosDir ?? DEFAULT_SCENARIOS_DIR,
		ids,
	);
	const outDir = join(config.outDir, `validate-${runId()}`);
	let failed = 0;
	for (const s of scenarios) {
		const r = await validateScenario(s, config, outDir, say);
		if (!r.ok) failed += 1;
		console.log(`${r.ok ? "PASS" : "FAIL"} ${s.id}`);
		for (const step of r.steps) {
			if (!step.ok) {
				const indented = step.output
					.split("\n")
					.map((l) => `      ${l}`)
					.join("\n");
				console.log(`  - ${step.step}\n${indented}`);
			}
		}
	}
	console.log(
		`\n${scenarios.length - failed}/${scenarios.length} scenarios valid`,
	);
	return failed === 0 ? 0 : 1;
}

async function cmdRun(
	config: BenchConfig,
	opts: { scenario: string[]; agent: string[]; trials?: number },
): Promise<number> {
	const scenarioFilter = opts.scenario.length
		? opts.scenario
		: config.scenarios === "all"
			? undefined
			: config.scenarios;
	const scenarios = await loadScenarios(
		config.scenariosDir ?? DEFAULT_SCENARIOS_DIR,
		scenarioFilter,
	);
	const agentConfigs = opts.agent.length
		? config.agents.filter((a) => opts.agent.includes(a.name))
		: config.agents;
	if (agentConfigs.length === 0) throw new Error("no agents selected");
	const agents = agentConfigs.map(createAgent);
	const trials = opts.trials ?? config.trials;
	const id = runId();
	const outDir = resolve(config.outDir, id);
	await mkdir(outDir, { recursive: true });

	const specs: TrialSpec[] = [];
	for (const scenario of scenarios) {
		for (const agent of agents) {
			for (let trial = 1; trial <= trials; trial++) {
				specs.push({
					runId: id,
					scenario,
					agent,
					trial,
					config,
					dir: join(outDir, scenario.id, agent.name, `trial-${trial}`),
					log: say,
				});
			}
		}
	}
	say(
		`run ${id}: ${scenarios.length} scenario(s) x ${agents.length} agent(s) x ${trials} trial(s) = ${specs.length} clusters, ${config.parallel} at a time`,
	);
	const startedAt = new Date().toISOString();
	const results = await runAll(specs, config.parallel);
	const summary: RunSummary = {
		schemaVersion: 1,
		runId: id,
		startedAt,
		finishedAt: new Date().toISOString(),
		config: { ...config, agents: agentConfigs },
		trials: results,
	};
	await writeFile(
		join(outDir, "summary.json"),
		`${JSON.stringify(summary, null, "\t")}\n`,
	);
	const md = renderMarkdown(aggregate(results));
	await writeFile(join(outDir, "summary.md"), md);
	console.log(md);
	say(`wrote ${outDir}`);
	return results.every((r) => r.error === null) ? 0 : 1;
}

async function cmdReport(
	dir: string,
	md?: string,
	json?: string,
): Promise<void> {
	const results = await collectResults(dir);
	if (results.length === 0)
		throw new Error(`no result.json files under ${dir}`);
	const report = aggregate(results);
	const rendered = renderMarkdown(report);
	if (md) await writeFile(md, rendered);
	if (json) await writeFile(json, `${JSON.stringify(report, null, "\t")}\n`);
	console.log(rendered);
}

export async function main(argv: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			config: { type: "string", short: "c", default: "bench.yaml" },
			scenario: { type: "string", short: "s", multiple: true, default: [] },
			agent: { type: "string", short: "a", multiple: true, default: [] },
			trials: { type: "string", short: "n" },
			out: { type: "string", short: "o" },
			parallel: { type: "string", short: "p" },
			"stop-on-green": { type: "boolean", default: false },
			md: { type: "string" },
			json: { type: "string" },
			help: { type: "boolean", short: "h", default: false },
		},
	});
	const [cmd, sub, ...rest] = positionals;
	if (values.help || !cmd) {
		console.log(USAGE);
		return values.help ? 0 : 1;
	}
	const loadConfig = async (): Promise<BenchConfig> => {
		const c = await loadBenchConfig(values.config);
		if (values.out) c.outDir = values.out;
		if (values.parallel) c.parallel = Number(values.parallel);
		if (values["stop-on-green"]) c.stopOnGreen = true;
		return c;
	};
	switch (cmd) {
		case "scenarios": {
			if (sub === "list") {
				await cmdScenariosList(DEFAULT_SCENARIOS_DIR);
				return 0;
			}
			if (sub === "validate")
				return cmdScenariosValidate(await loadConfig(), rest);
			console.log(USAGE);
			return 1;
		}
		case "run":
			return cmdRun(await loadConfig(), {
				scenario: values.scenario,
				agent: values.agent,
				trials: values.trials ? Number(values.trials) : undefined,
			});
		case "report": {
			if (!sub) throw new Error("report needs a results directory");
			await cmdReport(sub, values.md, values.json);
			return 0;
		}
		default:
			console.log(USAGE);
			return 1;
	}
}

if (import.meta.main) {
	main(process.argv.slice(2)).then(
		(code) => process.exit(code),
		(err) => {
			console.error(err instanceof Error ? err.message : String(err));
			process.exit(1);
		},
	);
}
