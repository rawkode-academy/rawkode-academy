import type { ModelPrice, TokenUsage } from "../pricing.ts";
import type { ClusterProvider } from "../providers/types.ts";

/** One line of transcript.jsonl. */
export type TranscriptEvent =
	| { t: number; type: "system"; text: string }
	| { t: number; type: "assistant"; text: string }
	| { t: number; type: "thinking"; text: string }
	| { t: number; type: "tool_call"; id: string; name: string; input: unknown }
	| {
			t: number;
			type: "tool_result";
			id: string;
			exitCode: number | null;
			output: string;
			durationMs: number;
	  }
	| { t: number; type: "usage"; turn: number; usage: TokenUsage }
	| { t: number; type: "verify"; passed: boolean; output: string }
	| { t: number; type: "raw"; data: unknown }
	| { t: number; type: "error"; text: string };

export type AgentExitReason =
	| "completed" // the agent said it was done
	| "timeout" // the harness cut it off
	| "stopped_on_green" // the harness stopped it because verify passed
	| "max_turns"
	| "refusal"
	| "error";

export interface AgentRunInput {
	/** The task statement, i.e. scenario.prompt. */
	prompt: string;
	/** Shell on the control-plane node. Every command the agent runs goes here. */
	cluster: ClusterProvider;
	/** Fires when the harness wants the agent to stop (timeout or green). */
	signal: AbortSignal;
	/** Append to transcript.jsonl. */
	log: (event: TranscriptEvent) => void;
	/** Per-command timeout for anything the agent executes. */
	commandTimeoutMs: number;
	/** Total wall-clock budget for this run; the signal fires when it is spent. */
	budgetMs: number;
	pricing: Record<string, ModelPrice>;
}

export interface AgentRunOutput {
	exitReason: AgentExitReason;
	/** The agent's own closing message, if any. */
	finalMessage: string | null;
	usage: TokenUsage;
	/** Reported by the agent itself (e.g. Claude Code's total_cost_usd), else null. */
	reportedCostUsd: number | null;
	turns: number;
	toolCalls: number;
	model: string;
	error?: string;
}

export interface Agent {
	readonly name: string;
	readonly type: string;
	readonly model: string;
	/**
	 * One-off preparation on a freshly created cluster, before setup/break run
	 * (e.g. installing a CLI on the node). Must not touch cluster state.
	 */
	prepare?(cluster: ClusterProvider): Promise<void>;
	run(input: AgentRunInput): Promise<AgentRunOutput>;
}

export interface AgentConfigBase {
	name: string;
	type: string;
	model?: string;
	/** Hard cap on agent turns (builtin) or `--max-turns` (claude-code). */
	maxTurns?: number;
}
