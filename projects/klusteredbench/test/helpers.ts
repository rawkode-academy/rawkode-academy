import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BenchConfig } from "../src/config.ts";
import type { TrialResult } from "../src/results.ts";

export const FIXTURES = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures",
	"scenarios",
);

export async function tmp(): Promise<string> {
	return mkdtemp(join(tmpdir(), "kb-test-"));
}

export function fakeConfig(overrides: Partial<BenchConfig> = {}): BenchConfig {
	return {
		provider: { type: "fake" },
		agents: [{ name: "fake", type: "fake" }],
		scenarios: "all",
		trials: 1,
		timeoutMs: 2_000,
		pollIntervalMs: 100,
		commandTimeoutMs: 5_000,
		stopOnGreen: false,
		parallel: 1,
		outDir: "results",
		scenariosDir: FIXTURES,
		...overrides,
	};
}

export function trial(overrides: Partial<TrialResult> = {}): TrialResult {
	return {
		schemaVersion: 1,
		runId: "r1",
		scenario: "s",
		agent: "a",
		agentType: "builtin",
		model: "claude-opus-5",
		trial: 1,
		startedAt: "2026-01-01T00:00:00Z",
		finishedAt: "2026-01-01T00:01:00Z",
		cluster: {
			provider: "fake",
			name: "x",
			serverVersion: null,
			nodeImage: null,
		},
		success: true,
		timeToGreenMs: 10_000,
		greenAtEnd: true,
		invariantsPassed: null,
		invariantsOutput: null,
		agentWallMs: 12_000,
		exitReason: "completed",
		usage: {
			inputTokens: 1000,
			outputTokens: 500,
			cacheWriteTokens: 0,
			cacheReadTokens: 0,
		},
		totalTokens: 1500,
		estimatedCostUsd: 0.0175,
		reportedCostUsd: null,
		turns: 3,
		toolCalls: 2,
		verifySamples: [],
		finalMessage: null,
		error: null,
		overheadMs: { create: 0, setup: 0, break: 0, destroy: 0 },
		...overrides,
	};
}
