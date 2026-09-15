import type { AgentExitReason } from "./agents/types.ts";
import type { TokenUsage } from "./pricing.ts";
import type { ClusterInfo } from "./providers/types.ts";

export interface VerifySample {
	/** ms since the agent started. */
	atMs: number;
	passed: boolean;
	output: string;
}

export interface TrialResult {
	schemaVersion: 1;
	runId: string;
	scenario: string;
	agent: string;
	agentType: string;
	model: string;
	trial: number;
	startedAt: string;
	finishedAt: string;
	cluster: ClusterInfo;
	/** Harness view of the outcome. */
	success: boolean;
	/** First moment verify passed, ms after the agent started. Null if never. */
	timeToGreenMs: number | null;
	/** Verify result after the agent stopped, whatever happened in between. */
	greenAtEnd: boolean;
	/** Optional post-conditions (e.g. "did not delete the database"). Null when the scenario defines none. */
	invariantsPassed: boolean | null;
	invariantsOutput: string | null;
	/** Agent wall clock, start to stop. */
	agentWallMs: number;
	exitReason: AgentExitReason;
	usage: TokenUsage;
	totalTokens: number;
	/** From the pricing table. Null when the model is unpriced. */
	estimatedCostUsd: number | null;
	/** From the agent itself when it reports one (Claude Code does). */
	reportedCostUsd: number | null;
	turns: number;
	toolCalls: number;
	verifySamples: VerifySample[];
	finalMessage: string | null;
	error: string | null;
	/** Cluster lifecycle overheads, for capacity planning; not part of any score. */
	overheadMs: { create: number; setup: number; break: number; destroy: number };
}

export interface RunSummary {
	schemaVersion: 1;
	runId: string;
	startedAt: string;
	finishedAt: string;
	config: unknown;
	trials: TrialResult[];
}
