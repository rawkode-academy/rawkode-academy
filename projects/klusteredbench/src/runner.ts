import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Agent, AgentRunOutput, TranscriptEvent } from "./agents/types.ts";
import type { BenchConfig } from "./config.ts";
import {
	DEFAULT_PRICING,
	EMPTY_USAGE,
	estimateCostUsd,
	totalTokens,
} from "./pricing.ts";
import { createProvider } from "./providers/index.ts";
import type { ClusterInfo, ClusterProvider } from "./providers/types.ts";
import type { TrialResult, VerifySample } from "./results.ts";
import { renderScript, type Scenario } from "./scenario.ts";
import { sleep } from "./util/time.ts";

export interface TrialSpec {
	runId: string;
	scenario: Scenario;
	agent: Agent;
	trial: number;
	config: BenchConfig;
	/** Directory that receives result.json, transcript.jsonl and the script logs. */
	dir: string;
	log?: (line: string) => void;
}

const SCRIPT_TIMEOUT_MS = 15 * 60_000;

async function runScript(
	cluster: ClusterProvider,
	scenario: Scenario,
	kind: "setup" | "break" | "verify" | "solve" | "invariants",
	dir: string,
	timeoutMs = SCRIPT_TIMEOUT_MS,
): Promise<{ ok: boolean; output: string; durationMs: number }> {
	const script = renderScript(scenario, kind);
	if (script === null)
		throw new Error(`scenario ${scenario.id} has no ${kind} script`);
	const r = await cluster.exec(script, { timeoutMs });
	const output =
		`${r.stdout}${r.stderr ? `\n--- stderr ---\n${r.stderr}` : ""}`.trim();
	await appendFile(
		join(dir, `${kind}.log`),
		`=== ${new Date().toISOString()} exit=${r.code}${r.timedOut ? " TIMED OUT" : ""}\n${output}\n\n`,
	);
	return { ok: r.code === 0 && !r.timedOut, output, durationMs: r.durationMs };
}

/**
 * One trial = one fresh cluster. Order is fixed:
 *   create -> agent.prepare -> setup (must be green) -> break (must be red)
 *   -> agent runs while verify polls -> final verify -> invariants -> destroy.
 *
 * "Time to green" is the harness's first passing verify, not the agent's
 * claim of completion; "success" is verify passing after the agent stopped.
 * The two differ when an agent fixes the cluster and then breaks it again,
 * and both are reported so that shows up.
 */
export async function runTrial(spec: TrialSpec): Promise<TrialResult> {
	const { scenario, agent, config, dir } = spec;
	const say = spec.log ?? (() => {});
	await mkdir(dir, { recursive: true });
	const startedAt = new Date();
	const cluster = createProvider(config.provider);
	const clusterName =
		`kb-${spec.runId}-${scenario.id}-${agent.name}-${spec.trial}`
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-")
			.slice(0, 60);
	const overhead = { create: 0, setup: 0, break: 0, destroy: 0 };
	const transcriptPath = join(dir, "transcript.jsonl");
	await writeFile(transcriptPath, "");
	const logEvent = (e: TranscriptEvent) => {
		void appendFile(transcriptPath, `${JSON.stringify(e)}\n`);
	};

	let info: ClusterInfo = {
		provider: cluster.kind,
		name: clusterName,
		serverVersion: null,
		nodeImage: null,
	};
	let agentOut: AgentRunOutput = {
		exitReason: "error",
		finalMessage: null,
		usage: EMPTY_USAGE,
		reportedCostUsd: null,
		turns: 0,
		toolCalls: 0,
		model: agent.model,
	};
	const samples: VerifySample[] = [];
	let timeToGreenMs: number | null = null;
	let greenAtEnd = false;
	let invariantsPassed: boolean | null = null;
	let invariantsOutput: string | null = null;
	let agentWallMs = 0;
	let error: string | null = null;

	try {
		say(
			`[${scenario.id}/${agent.name}#${spec.trial}] creating cluster ${clusterName}`,
		);
		const t0 = Date.now();
		info = await cluster.create(clusterName);
		overhead.create = Date.now() - t0;

		if (agent.prepare) {
			say(
				`[${scenario.id}/${agent.name}#${spec.trial}] preparing agent on node`,
			);
			await agent.prepare(cluster);
		}

		say(`[${scenario.id}/${agent.name}#${spec.trial}] setup`);
		const setup = await runScript(cluster, scenario, "setup", dir);
		overhead.setup = setup.durationMs;
		if (!setup.ok)
			throw new Error(`setup failed:\n${setup.output.slice(-3000)}`);

		say(`[${scenario.id}/${agent.name}#${spec.trial}] break`);
		const brk = await runScript(cluster, scenario, "break", dir);
		overhead.break = brk.durationMs;
		if (!brk.ok) throw new Error(`break failed:\n${brk.output.slice(-3000)}`);
		const stillGreen = await runScript(
			cluster,
			scenario,
			"verify",
			dir,
			120_000,
		);
		if (stillGreen.ok) {
			throw new Error(
				"verify passed immediately after break; the scenario is not broken",
			);
		}

		const budgetMs = scenario.timeoutMs ?? config.timeoutMs;
		const controller = new AbortController();
		const agentStart = Date.now();
		const deadline = setTimeout(() => controller.abort("timeout"), budgetMs);
		say(
			`[${scenario.id}/${agent.name}#${spec.trial}] agent running (budget ${Math.round(budgetMs / 1000)}s)`,
		);

		// Poll verify concurrently with the agent. Verify runs on the same node
		// the agent uses, which is a small perturbation we accept for now.
		let polling = true;
		const poller = (async () => {
			while (polling && !controller.signal.aborted) {
				await sleep(config.pollIntervalMs, controller.signal);
				if (!polling || controller.signal.aborted) break;
				const v = await runScript(cluster, scenario, "verify", dir, 120_000);
				const sample = {
					atMs: Date.now() - agentStart,
					passed: v.ok,
					output: v.output.slice(-500),
				};
				samples.push(sample);
				logEvent({
					t: Date.now(),
					type: "verify",
					passed: v.ok,
					output: sample.output,
				});
				if (v.ok && timeToGreenMs === null) {
					timeToGreenMs = sample.atMs;
					say(
						`[${scenario.id}/${agent.name}#${spec.trial}] GREEN after ${Math.round(timeToGreenMs / 1000)}s`,
					);
					if (config.stopOnGreen) controller.abort("stopped_on_green");
				}
			}
		})();

		try {
			agentOut = await agent.run({
				prompt: scenario.prompt,
				cluster,
				signal: controller.signal,
				log: logEvent,
				commandTimeoutMs: config.commandTimeoutMs,
				budgetMs,
				pricing: config.pricing ?? DEFAULT_PRICING,
			});
		} finally {
			polling = false;
			clearTimeout(deadline);
			if (!controller.signal.aborted) controller.abort("completed");
			agentWallMs = Date.now() - agentStart;
			await poller;
		}
		say(
			`[${scenario.id}/${agent.name}#${spec.trial}] agent stopped: ${agentOut.exitReason}`,
		);

		const final = await runScript(cluster, scenario, "verify", dir, 120_000);
		greenAtEnd = final.ok;
		samples.push({
			atMs: Date.now() - agentStart,
			passed: final.ok,
			output: final.output.slice(-500),
		});
		if (final.ok && timeToGreenMs === null) timeToGreenMs = agentWallMs;

		if (scenario.scripts.invariants !== null) {
			const inv = await runScript(
				cluster,
				scenario,
				"invariants",
				dir,
				120_000,
			);
			invariantsPassed = inv.ok;
			invariantsOutput = inv.output.slice(-2000) || null;
		}
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
		say(`[${scenario.id}/${agent.name}#${spec.trial}] ERROR ${error}`);
	} finally {
		const t0 = Date.now();
		try {
			await cluster.destroy();
		} catch (err) {
			say(
				`[${scenario.id}/${agent.name}#${spec.trial}] destroy failed: ${String(err)}`,
			);
		}
		overhead.destroy = Date.now() - t0;
	}

	const result: TrialResult = {
		schemaVersion: 1,
		runId: spec.runId,
		scenario: scenario.id,
		agent: agent.name,
		agentType: agent.type,
		model: agentOut.model,
		trial: spec.trial,
		startedAt: startedAt.toISOString(),
		finishedAt: new Date().toISOString(),
		cluster: info,
		success: error === null && greenAtEnd && invariantsPassed !== false,
		timeToGreenMs,
		greenAtEnd,
		invariantsPassed,
		invariantsOutput,
		agentWallMs,
		exitReason: agentOut.exitReason,
		usage: agentOut.usage,
		totalTokens: totalTokens(agentOut.usage),
		estimatedCostUsd: estimateCostUsd(
			agentOut.model,
			agentOut.usage,
			config.pricing ?? DEFAULT_PRICING,
		),
		reportedCostUsd: agentOut.reportedCostUsd,
		turns: agentOut.turns,
		toolCalls: agentOut.toolCalls,
		verifySamples: samples,
		finalMessage: agentOut.finalMessage,
		error: error ?? agentOut.error ?? null,
		overheadMs: overhead,
	};
	await writeFile(
		join(dir, "result.json"),
		`${JSON.stringify(result, null, "\t")}\n`,
	);
	return result;
}

/** Run a list of trial specs with bounded concurrency, preserving input order in the output. */
export async function runAll(
	specs: TrialSpec[],
	parallel: number,
): Promise<TrialResult[]> {
	const results: TrialResult[] = new Array(specs.length);
	let next = 0;
	const workers = Array.from({ length: Math.max(1, parallel) }, async () => {
		while (next < specs.length) {
			const i = next++;
			const spec = specs[i];
			if (!spec) break;
			results[i] = await runTrial(spec);
		}
	});
	await Promise.all(workers);
	return results;
}
