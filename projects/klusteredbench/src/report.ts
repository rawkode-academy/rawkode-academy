import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { TrialResult } from "./results.ts";
import { formatDuration } from "./util/time.ts";

export interface CellStats {
	scenario: string;
	agent: string;
	model: string;
	trials: number;
	successes: number;
	successRate: number;
	/** Over successful trials only. */
	medianTimeToGreenMs: number | null;
	meanAgentWallMs: number;
	meanTotalTokens: number;
	meanOutputTokens: number;
	meanCostUsd: number | null;
	/** Total spend across all trials in the cell, successful or not. */
	totalCostUsd: number | null;
	meanTurns: number;
	meanToolCalls: number;
	/** Dollars per successful fix: total spend / successes. Infinity when no successes. */
	costPerSuccessUsd: number | null;
	timeouts: number;
	errors: number;
	invariantFailures: number;
}

export interface AgentStats {
	agent: string;
	model: string;
	scenarios: number;
	trials: number;
	successRate: number;
	medianTimeToGreenMs: number | null;
	totalCostUsd: number | null;
	costPerSuccessUsd: number | null;
	meanTotalTokens: number;
}

export interface Report {
	runIds: string[];
	cells: CellStats[];
	agents: AgentStats[];
}

function median(xs: number[]): number | null {
	if (xs.length === 0) return null;
	const s = [...xs].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2
		? (s[mid] as number)
		: ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}
const mean = (xs: number[]) =>
	xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** Prefer what the agent reported (Claude Code bills itself); fall back to the table. */
export function trialCost(t: TrialResult): number | null {
	return t.reportedCostUsd ?? t.estimatedCostUsd;
}

function sumCost(ts: TrialResult[]): number | null {
	const costs = ts.map(trialCost);
	if (costs.some((c) => c === null)) return null;
	return costs.reduce<number>((a, b) => a + (b as number), 0);
}

function perSuccess(total: number | null, successes: number): number | null {
	if (total === null) return null;
	return successes === 0 ? Number.POSITIVE_INFINITY : total / successes;
}

export function aggregate(trials: TrialResult[]): Report {
	const byCell = new Map<string, TrialResult[]>();
	for (const t of trials) {
		const key = `${t.scenario}|${t.agent}`;
		byCell.set(key, [...(byCell.get(key) ?? []), t]);
	}
	const cells: CellStats[] = [];
	for (const ts of byCell.values()) {
		const first = ts[0] as TrialResult;
		const ok = ts.filter((t) => t.success);
		const total = sumCost(ts);
		cells.push({
			scenario: first.scenario,
			agent: first.agent,
			model: first.model,
			trials: ts.length,
			successes: ok.length,
			successRate: ok.length / ts.length,
			medianTimeToGreenMs: median(
				ok.map((t) => t.timeToGreenMs).filter((x): x is number => x !== null),
			),
			meanAgentWallMs: mean(ts.map((t) => t.agentWallMs)),
			meanTotalTokens: mean(ts.map((t) => t.totalTokens)),
			meanOutputTokens: mean(ts.map((t) => t.usage.outputTokens)),
			meanCostUsd: total === null ? null : total / ts.length,
			totalCostUsd: total,
			meanTurns: mean(ts.map((t) => t.turns)),
			meanToolCalls: mean(ts.map((t) => t.toolCalls)),
			costPerSuccessUsd: perSuccess(total, ok.length),
			timeouts: ts.filter((t) => t.exitReason === "timeout").length,
			errors: ts.filter((t) => t.error !== null).length,
			invariantFailures: ts.filter((t) => t.invariantsPassed === false).length,
		});
	}
	cells.sort(
		(a, b) =>
			a.scenario.localeCompare(b.scenario) || a.agent.localeCompare(b.agent),
	);

	const byAgent = new Map<string, TrialResult[]>();
	for (const t of trials)
		byAgent.set(t.agent, [...(byAgent.get(t.agent) ?? []), t]);
	const agents: AgentStats[] = [];
	for (const [agent, ts] of byAgent) {
		const ok = ts.filter((t) => t.success);
		const total = sumCost(ts);
		agents.push({
			agent,
			model: (ts[0] as TrialResult).model,
			scenarios: new Set(ts.map((t) => t.scenario)).size,
			trials: ts.length,
			successRate: ok.length / ts.length,
			medianTimeToGreenMs: median(
				ok.map((t) => t.timeToGreenMs).filter((x): x is number => x !== null),
			),
			totalCostUsd: total,
			costPerSuccessUsd: perSuccess(total, ok.length),
			meanTotalTokens: mean(ts.map((t) => t.totalTokens)),
		});
	}
	agents.sort(
		(a, b) =>
			b.successRate - a.successRate ||
			(a.costPerSuccessUsd ?? 0) - (b.costPerSuccessUsd ?? 0),
	);
	return { runIds: [...new Set(trials.map((t) => t.runId))], cells, agents };
}

const usd = (x: number | null) =>
	x === null
		? "n/a"
		: x === Number.POSITIVE_INFINITY
			? "inf"
			: `$${x.toFixed(3)}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const k = (x: number) =>
	x >= 1000 ? `${(x / 1000).toFixed(1)}k` : String(Math.round(x));

function table(headers: string[], rows: string[][]): string {
	const widths = headers.map((h, i) =>
		Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
	);
	const line = (cells: string[]) =>
		`| ${cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join(" | ")} |`;
	return [
		line(headers),
		`|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`,
		...rows.map(line),
	].join("\n");
}

export function renderMarkdown(report: Report): string {
	const out: string[] = [];
	out.push(
		"# KlusteredBench results",
		"",
		`Runs: ${report.runIds.join(", ")}`,
		"",
	);
	out.push("## Agents", "");
	out.push(
		table(
			[
				"agent",
				"model",
				"scenarios",
				"trials",
				"success",
				"median time-to-green",
				"mean tokens",
				"total cost",
				"cost / success",
			],
			report.agents.map((a) => [
				a.agent,
				a.model,
				String(a.scenarios),
				String(a.trials),
				pct(a.successRate),
				formatDuration(a.medianTimeToGreenMs),
				k(a.meanTotalTokens),
				usd(a.totalCostUsd),
				usd(a.costPerSuccessUsd),
			]),
		),
	);
	out.push("", "## Scenario by agent", "");
	out.push(
		table(
			[
				"scenario",
				"agent",
				"trials",
				"success",
				"median time-to-green",
				"mean wall",
				"mean tokens",
				"mean out",
				"mean turns",
				"mean cost",
				"cost / success",
				"timeouts",
				"errors",
				"invariant fails",
			],
			report.cells.map((c) => [
				c.scenario,
				c.agent,
				String(c.trials),
				pct(c.successRate),
				formatDuration(c.medianTimeToGreenMs),
				formatDuration(c.meanAgentWallMs),
				k(c.meanTotalTokens),
				k(c.meanOutputTokens),
				c.meanTurns.toFixed(1),
				usd(c.meanCostUsd),
				usd(c.costPerSuccessUsd),
				String(c.timeouts),
				String(c.errors),
				String(c.invariantFailures),
			]),
		),
	);
	out.push("");
	return out.join("\n");
}

/** Recursively collect every result.json under a directory. */
export async function collectResults(root: string): Promise<TrialResult[]> {
	const out: TrialResult[] = [];
	const walk = async (dir: string) => {
		for (const entry of await readdir(dir)) {
			const p = join(dir, entry);
			const s = await stat(p);
			if (s.isDirectory()) await walk(p);
			else if (entry === "result.json") {
				const parsed = JSON.parse(await readFile(p, "utf8")) as TrialResult;
				if (parsed.schemaVersion === 1) out.push(parsed);
			}
		}
	};
	await walk(root);
	return out;
}
